import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";
import { m } from "@saasweave/i18n/messages";
import { type LinkProps } from "@saasweave/i18n/tanstack-start/components/link";

type NavbarLink =
  | { label: () => string; href: LinkProps["href"]; to?: never }
  | { label: () => string; href?: never; to: LinkProps["to"] };

export const navLinks: NavbarLink[] = [
  {
    label: () => m.navbar__pricing(),
    to: "/pricing"
  },
  {
    label: () => m.navbar__playground(),
    to: "/playground"
  },
  {
    label: () => m.navbar__dashboard(),
    to: "/app"
  },
  {
    href: `${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL}/docs`,
    label: () => m.navbar__api_docs()
  }
];
