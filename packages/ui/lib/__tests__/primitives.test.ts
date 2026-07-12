import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Button } from "@saasweave/ui/components/button";
import { Checkbox } from "@saasweave/ui/components/checkbox";
import { Input } from "@saasweave/ui/components/input";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";

describe("accessible UI primitives", () => {
  it.each([
    [true, "checked"],
    [false, "unchecked"]
  ])("exposes controlled checkbox state %s", (checked, expectedState) => {
    const html = renderToStaticMarkup(
      createElement(Checkbox, {
        "aria-label": "Receive product updates",
        checked,
        disabled: checked
      })
    );

    expect(html).toContain('role="checkbox"');
    expect(html).toContain(`aria-checked="${checked}"`);
    expect(html).toContain(`data-state="${expectedState}"`);
    expect(html).toContain('aria-label="Receive product updates"');
    expect(html.includes('disabled=""')).toBe(checked);
  });

  it("forwards button semantics and variant state", () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        {
          "aria-pressed": true,
          disabled: true,
          type: "submit",
          variant: "destructive"
        },
        "Delete"
      )
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-variant="destructive"');
    expect(html).toContain("disabled");
  });

  it("preserves child link semantics when Button uses asChild", () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { asChild: true, variant: "link" },
        createElement("a", { href: "/settings" }, "Settings")
      )
    );

    expect(html.startsWith("<a ")).toBe(true);
    expect(html).toContain('href="/settings"');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-variant="link"');
  });

  it("forwards invalid and disabled input accessibility attributes", () => {
    const html = renderToStaticMarkup(
      createElement(Input, {
        "aria-describedby": "email-error",
        "aria-invalid": true,
        disabled: true,
        name: "email",
        type: "email"
      })
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toContain('name="email"');
    expect(html).toContain("disabled");
  });
});

describe("useIsClient", () => {
  it("stays false during server rendering to avoid hydration divergence", () => {
    function ClientStateProbe() {
      const isClient = useIsClient();
      return createElement("span", { "data-is-client": String(isClient) });
    }

    const html = renderToStaticMarkup(createElement(ClientStateProbe));
    expect(html).toContain('data-is-client="false"');
  });
});
