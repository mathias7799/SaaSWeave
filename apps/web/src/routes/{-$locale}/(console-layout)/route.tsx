import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, UserPlus } from "lucide-react";
import { useEffect } from "react";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";
import {
  getAuthStateQueryOptions,
  getAuthUserQueryOptions
} from "@saasweave/auth/react/tanstack-start/queries";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { useLocation } from "@saasweave/i18n/tanstack-start/hooks/use-location";
import { useNavigate } from "@saasweave/i18n/tanstack-start/hooks/use-navigate";
import { redirect } from "@saasweave/i18n/tanstack-start/lib/redirect";
import { stripLocalePrefix } from "@saasweave/i18n/tanstack-start/lib/strip-locale-prefix";
import { validateNavigateTo } from "@saasweave/i18n/tanstack-start/lib/validate-navigate-to";
import { Button } from "@saasweave/ui/components/button";

import { ConsoleOrgSwitcher, SidebarPlanCard, useConsoleNavGroups } from "@/features/console-nav";

import { ConsoleLayout } from "@/widgets/console-layout";

import { routeTree } from "@/routeTree.gen";

export const Route = createFileRoute("/{-$locale}/(console-layout)")({
  beforeLoad: async ({ context, location, preload }) => {
    const state = await context.queryClient.ensureQueryData(
      preload
        ? getAuthStateQueryOptions()
        : { ...getAuthStateQueryOptions(), revalidateIfStale: true }
    );
    const user = state.user;

    if (!user) {
      if (preload) return;
      const currentHref = stripLocalePrefix(location.href);
      const redirectTo = validateNavigateTo({
        fallbackTo: "/",
        routeTree,
        shouldIncludeRoute: (route) => !route.id.includes("(guest)"),
        to: currentHref
      });

      throw redirect({
        search: {
          redirect: redirectTo
        },
        to: "/sign-in"
      });
    }

    if (!preload) {
      await context.queryClient.ensureQueryData(orpc.console.features.queryOptions());
    }

    // Retype the Route context to include a non-null user prop
    return { user };
  },
  component: ConsoleLayoutRoute
});

function ConsoleLayoutRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useQuery(getAuthUserQueryOptions());
  const navGroups = useConsoleNavGroups();

  useEffect(() => {
    if (user === null) {
      const redirectTo = validateNavigateTo({
        fallbackTo: "/",
        routeTree,
        shouldIncludeRoute: (route) => !route.id.includes("(guest)"),
        to: stripLocalePrefix(location.href)
      });

      void navigate({
        search: {
          redirect: redirectTo
        },
        to: "/sign-in"
      });
    }
  }, [user, navigate, location.href]);

  return (
    <ConsoleLayout
      groups={navGroups}
      homeTo="/app"
      ariaLabel="Workspace"
      topSlot={<ConsoleOrgSwitcher />}
      footer={<SidebarPlanCard />}
      actions={
        <>
          {user?.role === "admin" ? (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/admin">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Admin
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/app/team">
              <UserPlus className="size-4" aria-hidden="true" />
              Invite
            </Link>
          </Button>
        </>
      }
    >
      <Outlet />
    </ConsoleLayout>
  );
}
