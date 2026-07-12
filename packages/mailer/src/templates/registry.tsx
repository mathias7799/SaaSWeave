/** @jsxImportSource react */
import * as React from "react";
import { Section } from "react-email";

import { EmailButton, EmailHeading, EmailLayout, EmailText } from "#@/templates/base";

type ReactElement = React.ReactElement;

export type TemplateField = {
  key: string;
  label: string;
  kind: "copy" | "data";
  multiline?: boolean;
  default: string;
};

export type EmailTemplate = {
  key: string;
  name: string;
  description: string;
  /** Subject line, may contain {token} placeholders resolved from field values. */
  subject: string;
  fields: TemplateField[];
  Component: (values: Record<string, string>) => ReactElement;
};

function Simple({
  values,
  urlKey
}: {
  values: Record<string, string>;
  urlKey: string;
}): ReactElement {
  return (
    <EmailLayout preview={values.heading ?? ""}>
      <EmailHeading>{values.heading}</EmailHeading>
      <EmailText>{values.body}</EmailText>
      {values[urlKey] ? (
        <Section style={{ marginTop: 8 }}>
          <EmailButton href={values[urlKey]}>{values.ctaLabel}</EmailButton>
        </Section>
      ) : null}
    </EmailLayout>
  );
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    Component: (values) => <Simple values={values} urlKey="actionUrl" />,
    description: "Sent to a new user right after they sign up.",
    fields: [
      { default: "Welcome to SaaSWeave", key: "heading", kind: "copy", label: "Heading" },
      {
        default:
          "Hi {name}, your workspace is ready. Track product usage, meter AI consumption, and bill for it, all in one place.",
        key: "body",
        kind: "copy",
        label: "Body",
        multiline: true
      },
      { default: "Open your console", key: "ctaLabel", kind: "copy", label: "Button label" },
      { default: "there", key: "name", kind: "data", label: "Recipient name" },
      { default: "https://saasweave.io/app", key: "actionUrl", kind: "data", label: "Console URL" }
    ],
    key: "welcome",
    name: "Welcome",
    subject: "Welcome to SaaSWeave, {name}"
  },
  {
    Component: (values) => <Simple values={values} urlKey="acceptUrl" />,
    description: "Sent when a workspace member is invited.",
    fields: [
      { default: "You've been invited", key: "heading", kind: "copy", label: "Heading" },
      {
        default: "{inviterName} invited you to join {workspaceName} on SaaSWeave.",
        key: "body",
        kind: "copy",
        label: "Body",
        multiline: true
      },
      { default: "Accept invitation", key: "ctaLabel", kind: "copy", label: "Button label" },
      { default: "A teammate", key: "inviterName", kind: "data", label: "Inviter name" },
      { default: "a workspace", key: "workspaceName", kind: "data", label: "Workspace name" },
      {
        default: "https://saasweave.io/accept",
        key: "acceptUrl",
        kind: "data",
        label: "Accept URL"
      }
    ],
    key: "invitation",
    name: "Team invitation",
    subject: "{inviterName} invited you to {workspaceName}"
  },
  {
    Component: (values) => <Simple values={values} urlKey="manageUrl" />,
    description: "Sent when a subscription is created or changed.",
    fields: [
      { default: "Your subscription is active", key: "heading", kind: "copy", label: "Heading" },
      {
        default:
          "Hi {name}, you're now on the {planName} plan. Manage your plan, seats, and invoices any time.",
        key: "body",
        kind: "copy",
        label: "Body",
        multiline: true
      },
      { default: "Manage billing", key: "ctaLabel", kind: "copy", label: "Button label" },
      { default: "there", key: "name", kind: "data", label: "Recipient name" },
      { default: "Scale", key: "planName", kind: "data", label: "Plan name" },
      {
        default: "https://saasweave.io/app/billing",
        key: "manageUrl",
        kind: "data",
        label: "Billing URL"
      }
    ],
    key: "subscription",
    name: "Subscription receipt",
    subject: "Your SaaSWeave {planName} subscription"
  },
  {
    Component: (values) => <Simple values={values} urlKey="actionUrl" />,
    description: "Sent when a user requests a password reset.",
    fields: [
      { default: "Reset your password", key: "heading", kind: "copy", label: "Heading" },
      {
        default:
          "Hi {name}, we received a request to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.",
        key: "body",
        kind: "copy",
        label: "Body",
        multiline: true
      },
      { default: "Reset password", key: "ctaLabel", kind: "copy", label: "Button label" },
      { default: "there", key: "name", kind: "data", label: "Recipient name" },
      {
        default: "https://saasweave.io/reset-password",
        key: "actionUrl",
        kind: "data",
        label: "Reset URL"
      }
    ],
    key: "password-reset",
    name: "Password reset",
    subject: "Reset your SaaSWeave password"
  },
  {
    Component: (values) => <Simple values={values} urlKey="actionUrl" />,
    description: "Sent when a user requests a magic link to sign in.",
    fields: [
      { default: "Sign in to SaaSWeave", key: "heading", kind: "copy", label: "Heading" },
      {
        default:
          "Hi {name}, use the button below to sign in. This link expires in 10 minutes. If you didn't request this, you can ignore this email.",
        key: "body",
        kind: "copy",
        label: "Body",
        multiline: true
      },
      { default: "Sign in", key: "ctaLabel", kind: "copy", label: "Button label" },
      { default: "there", key: "name", kind: "data", label: "Recipient name" },
      {
        default: "https://saasweave.io/sign-in",
        key: "actionUrl",
        kind: "data",
        label: "Magic link URL"
      }
    ],
    key: "magic-link",
    name: "Magic link",
    subject: "Your SaaSWeave sign-in link"
  }
];

export function getTemplate(key: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((template) => template.key === key);
}
