import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { useLocation } from "@saasweave/i18n/tanstack-start/hooks/use-location";
import { stripLocalePrefix } from "@saasweave/i18n/tanstack-start/lib/strip-locale-prefix";
import { Button } from "@saasweave/ui/components/button";

export function NavbarUnauthenticatedButtons() {
  const location = useLocation();
  const redirect = stripLocalePrefix(location.href);

  return (
    <>
      <Button asChild size="sm" variant="outline">
        <Link to="/sign-in" search={{ redirect }}>
          {m.navbar__sign_in()}
        </Link>
      </Button>
      <Link to="/create-an-account" search={{ redirect }}>
        <Button light="skeuomorphic" size="sm">
          {m.navbar__get_started()}
        </Button>
      </Link>
    </>
  );
}
