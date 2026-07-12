import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { getAuthStateQueryOptions } from "@saasweave/auth/react/tanstack-start/queries";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { redirect } from "@saasweave/i18n/tanstack-start/lib/redirect";
import { stripLocalePrefix } from "@saasweave/i18n/tanstack-start/lib/strip-locale-prefix";
import { validateNavigateTo } from "@saasweave/i18n/tanstack-start/lib/validate-navigate-to";
import { Button } from "@saasweave/ui/components/button";

import { Badge } from "@/shared/ui/console-kit";

import { adminNav } from "@/features/console-nav";

import { ConsoleLayout } from "@/widgets/console-layout";

import { routeTree } from "@/routeTree.gen";

export const Route = createFileRoute("/{-$locale}/(admin-layout)")({
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
      throw redirect({ search: { redirect: redirectTo }, to: "/sign-in" });
    }

    // Only platform operators (admin-plugin role) may enter the admin surface.
    if (user.role !== "admin") {
      if (preload) return;
      throw redirect({ to: "/app" });
    }

    return { user };
  },
  component: AdminLayoutRoute
});

function AdminLayoutRoute() {
  return (
    <ConsoleLayout
      groups={adminNav}
      homeTo="/admin"
      ariaLabel="Platform admin"
      badge={<Badge tone="brand">Platform admin</Badge>}
      footer={
        <Link
          to="/app"
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-brand-border/70 hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to workspace
        </Link>
      }
      actions={
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link to="/app">Exit admin</Link>
        </Button>
      }
    >
      <Outlet />
    </ConsoleLayout>
  );
}
