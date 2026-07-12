import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@saasweave/auth/react/auth-client";
import { getAuthUserQueryOptions } from "@saasweave/auth/react/tanstack-start/queries";
import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { useNavigate } from "@saasweave/i18n/tanstack-start/hooks/use-navigate";
import { type NavigateTo } from "@saasweave/i18n/tanstack-start/types";
import { Button } from "@saasweave/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@saasweave/ui/components/field";
import { Input } from "@saasweave/ui/components/input";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";
import { cn } from "@saasweave/ui/lib/utils";

import { Container } from "@/shared/ui/container";
import { LogoIcon } from "@/shared/ui/logo";

import { useAuthProviders } from "@/features/auth/api/use-auth-providers";
import { MagicLinkForm } from "@/features/auth/ui/magic-link-form";
import { OAuthButtons } from "@/features/auth/ui/oauth-buttons";
import { SsoSignInButton } from "@/features/auth/ui/sso-sign-in-button";

import { appConfig } from "@/config/app.config";

export function SignInForm({
  redirectTo = "/",
  className,
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: NavigateTo }) {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const queryClient = useQueryClient();
  const providers = useAuthProviders();
  const callbackUrl = new URL("/app", appConfig.site.url).href;

  const signInMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password
      });

      if (!result.data) {
        throw new Error(result.error?.message ?? m.auth__sign_in_failed());
      }

      return result;
    },
    onError: (error: Error) => {
      toast.error(error.message || m.auth__sign_in_failed());
    },
    onSuccess: async () => {
      // Invalidate auth cache to force refetch with new user data
      await queryClient.invalidateQueries(getAuthUserQueryOptions());
      await navigate({
        to: redirectTo
      });
      toast.success(m.auth__sign_in_successful());
    }
  });

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
    onSubmit: async ({ value }) => {
      signInMutation.mutate(value);
    },
    validators: {
      onSubmit: z.object({
        email: z.email(m.auth__invalid_email()),
        password: z.string().min(8, m.auth__password_min_length())
      })
    }
  });

  return (
    <Container className={cn("flex max-w-md flex-col gap-6", className)} {...props}>
      <form
        method="post"
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await form.handleSubmit();
        }}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <Link href="/" className="flex flex-col items-center gap-2 font-medium">
              <LogoIcon className="flex size-8 items-center justify-center rounded-md" />
              <span className="sr-only">{appConfig.site.shortName}</span>
            </Link>
            <h1 className="text-xl font-bold">{m.auth__sign_in_title()}</h1>
            <FieldDescription>
              {m.auth__sign_in_no_account()}{" "}
              <Link to="/create-an-account" search={{ redirect: redirectTo }}>
                {m.auth__sign_in_create_account()}
              </Link>
            </FieldDescription>
          </div>

          <form.Field name="email">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{m.auth__email_label()}</FieldLabel>
                <Input
                  disabled={!isClient}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="email"
                  value={field.state.value}
                  placeholder={m.auth__email_placeholder()}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-sm text-destructive" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </Field>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor={field.name}>{m.auth__password_label()}</FieldLabel>
                  <Link
                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    to="/forgot-password"
                  >
                    {m.auth__forgot_password_link()}
                  </Link>
                </div>
                <Input
                  disabled={!isClient}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-sm text-destructive" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </Field>
            )}
          </form.Field>

          <Field>
            <Button
              light="skeuomorphic"
              type="submit"
              disabled={!isClient || signInMutation.isPending || signInMutation.isSuccess}
            >
              {signInMutation.isPending ? m.auth__signing_in() : m.auth__sign_in()}
            </Button>
          </Field>

          <OAuthButtons callbackUrl={callbackUrl} />
          {providers.data?.magicLink ? <MagicLinkForm callbackUrl={callbackUrl} /> : null}
          <SsoSignInButton callbackUrl={callbackUrl} />
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {m.auth__terms_agreement()} <Link to="/terms-of-service">{m.auth__terms_of_service()}</Link>{" "}
        {m.auth__and()} <Link to="/privacy-policy">{m.auth__privacy_policy()}</Link>.
      </FieldDescription>
    </Container>
  );
}
