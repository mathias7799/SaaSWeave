import { describe, expect, it } from "vite-plus/test";

import { renderTemplate } from "#@/render";
import { EMAIL_TEMPLATES, type EmailTemplate } from "#@/templates/registry";

const SUPPORTED_LOCALES = ["en", "de"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type LocaleCopy = {
  subject: string;
  copy: Record<string, string>;
};

/** German subject + copy overrides — every registry template must have an entry. */
const LOCALIZED_DE_COPY: Record<string, LocaleCopy> = {
  invitation: {
    copy: {
      body: "{inviterName} hat dich eingeladen, {workspaceName} auf SaaSWeave beizutreten.",
      ctaLabel: "Einladung annehmen",
      heading: "Du wurdest eingeladen"
    },
    subject: "{inviterName} hat dich zu {workspaceName} eingeladen"
  },
  "magic-link": {
    copy: {
      body: "Hallo {name}, nutze die Schaltfläche unten, um dich anzumelden. Dieser Link läuft in 10 Minuten ab. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
      ctaLabel: "Anmelden",
      heading: "Bei SaaSWeave anmelden"
    },
    subject: "Dein SaaSWeave-Anmeldelink"
  },
  "password-reset": {
    copy: {
      body: "Hallo {name}, wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Dieser Link läuft in 1 Stunde ab. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
      ctaLabel: "Passwort zurücksetzen",
      heading: "Passwort zurücksetzen"
    },
    subject: "Setze dein SaaSWeave-Passwort zurück"
  },
  subscription: {
    copy: {
      body: "Hallo {name}, du bist jetzt im {planName}-Tarif. Verwalte deinen Tarif, Sitze und Rechnungen jederzeit.",
      ctaLabel: "Abrechnung verwalten",
      heading: "Dein Abonnement ist aktiv"
    },
    subject: "Dein SaaSWeave-{planName}-Abonnement"
  },
  welcome: {
    copy: {
      body: "Hallo {name}, dein Workspace ist bereit. Verfolge Produktnutzung, messe KI-Verbrauch und berechne alles an einem Ort ab.",
      ctaLabel: "Konsole öffnen",
      heading: "Willkommen bei SaaSWeave"
    },
    subject: "Willkommen bei SaaSWeave, {name}"
  }
};

const SAMPLE_DATA: Record<string, Record<string, string>> = {
  invitation: {
    acceptUrl: "https://saasweave.io/accept",
    inviterName: "Alex",
    workspaceName: "Acme Labs"
  },
  "magic-link": {
    actionUrl: "https://saasweave.io/sign-in?token=sample",
    name: "Jane"
  },
  "password-reset": {
    actionUrl: "https://saasweave.io/reset-password?token=sample",
    name: "Jane"
  },
  subscription: {
    manageUrl: "https://saasweave.io/app/billing",
    name: "Jane",
    planName: "Scale"
  },
  welcome: {
    actionUrl: "https://saasweave.io/app",
    name: "Jane"
  }
};

function registryEnglishCopy(template: EmailTemplate): LocaleCopy {
  return {
    copy: Object.fromEntries(
      template.fields
        .filter((field) => field.kind === "copy")
        .map((field) => [field.key, field.default])
    ),
    subject: template.subject
  };
}

function getLocaleCopy(template: EmailTemplate, locale: SupportedLocale): LocaleCopy {
  if (locale === "en") return registryEnglishCopy(template);
  const localized = LOCALIZED_DE_COPY[template.key];
  if (!localized) {
    throw new Error(`Missing German locale copy for template: ${template.key}`);
  }
  return localized;
}

/** Mirrors sendTemplate's getEmailCopy → renderTemplate flow without hitting the DB. */
async function renderWithEmailCopy(
  template: EmailTemplate,
  locale: SupportedLocale,
  values: Record<string, string>
) {
  const override = getLocaleCopy(template, locale);
  return renderTemplate(template.key, values, override.copy, override.subject);
}

describe("email template registry", () => {
  it("includes the magic-link template", () => {
    expect(EMAIL_TEMPLATES.some((template) => template.key === "magic-link")).toBe(true);
  });

  it("has German locale copy for every registered template", () => {
    for (const template of EMAIL_TEMPLATES) {
      expect(LOCALIZED_DE_COPY[template.key]).toBeDefined();
    }
  });

  it.each(EMAIL_TEMPLATES.map((template) => [template.key] as const))(
    "%s renders HTML with sample data",
    async (key) => {
      const values = SAMPLE_DATA[key] ?? {};
      const rendered = await renderTemplate(key, values);

      expect(rendered).not.toBeNull();
      expect(rendered!.html.length).toBeGreaterThan(0);
      expect(rendered!.text.length).toBeGreaterThan(0);
      expect(rendered!.html).toContain("<!DOCTYPE html");
    }
  );

  it.each(
    EMAIL_TEMPLATES.flatMap((template) =>
      SUPPORTED_LOCALES.map((locale) => [template.key, template, locale] as const)
    )
  )("%s resolves a non-empty subject for locale %s", async (_key, template, locale) => {
    const values = SAMPLE_DATA[template.key] ?? {};
    const rendered = await renderWithEmailCopy(template, locale, values);

    expect(rendered).not.toBeNull();
    expect(rendered!.subject.trim().length).toBeGreaterThan(0);
  });

  it("magic-link renders a sign-in button with the supplied URL", async () => {
    const actionUrl = "https://saasweave.io/sign-in?token=test-magic";
    const rendered = await renderTemplate("magic-link", {
      actionUrl,
      name: "Jane"
    });

    expect(rendered).not.toBeNull();
    expect(rendered!.html).toContain(actionUrl);
    expect(rendered!.subject).toBe("Your SaaSWeave sign-in link");
  });
});
