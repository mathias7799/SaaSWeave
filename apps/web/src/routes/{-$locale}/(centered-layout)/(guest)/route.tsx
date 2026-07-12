import { Outlet, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ensureAuthState } from "@saasweave/auth/react/tanstack-start/queries";
import { redirect } from "@saasweave/i18n/tanstack-start/lib/redirect";
import { validateNavigateTo } from "@saasweave/i18n/tanstack-start/lib/validate-navigate-to";

import { routeTree } from "@/routeTree.gen";

const guestSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .catch(undefined)
    .transform((val) =>
      validateNavigateTo({
        fallbackTo: "/app",
        routeTree,
        shouldIncludeRoute: (route) => !route.id.includes("(guest)"),
        to: val
      })
    )
});

export const Route = createFileRoute("/{-$locale}/(centered-layout)/(guest)")({
  validateSearch: guestSearchSchema,
  component: Outlet,
  beforeLoad: async ({ context, search, preload }) => {
    const { user } = await ensureAuthState(context.queryClient, { preload });

    // `redirect` is always NavigateTo (never undefined) thanks to schema transform & i18n path validation util
    const redirectTo = search.redirect;

    if (user) {
      throw redirect({
        to: redirectTo
      });
    }

    return {
      // We pass this as context so that it can be used in the sign-in/sign-up pages to redirect after successful authentication
      redirectTo
    };
  }
});
