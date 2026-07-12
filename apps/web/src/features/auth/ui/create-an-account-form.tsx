import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@saasweave/auth/react/auth-client";
import { useAuth } from "@saasweave/auth/react/tanstack-start/hooks";
import { getAuthUserQueryOptions } from "@saasweave/auth/react/tanstack-start/queries";
import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { useNavigate } from "@saasweave/i18n/tanstack-start/hooks/use-navigate";
import { type NavigateTo } from "@saasweave/i18n/tanstack-start/types";
import { Button } from "@saasweave/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@saasweave/ui/components/field";
import { Input } from "@saasweave/ui/components/input";
import { Spinner } from "@saasweave/ui/components/spinner";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";
import { cn } from "@saasweave/ui/lib/utils";

import { useGetPublicSettingsQuery } from "@/shared/api/get-public-settings.query";
import { Container } from "@/shared/ui/container";
import { LogoIcon } from "@/shared/ui/logo";

import { OAuthButtons } from "@/features/auth/ui/oauth-buttons";

import { appConfig } from "@/config/app.config";

export function CreateAnAccountForm({
  redirectTo = "/",
  className,
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: NavigateTo }) {
  const navigate = useNavigate();
  const isClient = useIsClient();
  const queryClient = useQueryClient();
  const { isPending } = useAuth();
  const settingsQuery = useGetPublicSettingsQuery();
  const signupsClosed = settingsQuery.data?.signupsOpen === false;
  const callbackUrl = new URL("/app", appConfig.site.url).href;

  const signUpMutation = useMutation({
    mutationFn: async (values: { email: string; name: string; password: string }) => {
      const result = await authClient.signUp.email({
        email: values.email,
        name: values.name,
        password: values.password
      });

      if (!result.data) {
        throw new Error(result.error?.message ?? m.auth__sign_up_failed());
      }

      return result;
    },
    onError: (error: Error) => {
      toast.error(error.message || m.auth__sign_up_failed());
    },
    onSuccess: async () => {
      // Invalidate auth cache to force refetch with new user data
      await queryClient.invalidateQueries(getAuthUserQueryOptions());
      // New accounts land in onboarding first; it forwards to `redirectTo` when done.
      await navigate({
        search: { redirect: redirectTo },
        to: "/onboarding"
      });
      toast.success(m.auth__sign_up_successful());
    }
  });

  const form = useForm({
    defaultValues: {
      confirmPassword: "",
      email: "",
      name: "",
      password: ""
    },
    onSubmit: async ({ value }) => {
      const { email, name, password } = value;
      signUpMutation.mutate({ email, name, password });
    },
    validators: {
      onSubmit: z
        .object({
          confirmPassword: z.string(),
          email: z.email(m.auth__invalid_email()),
          name: z.string().min(2, m.auth__name_min_length()),
          password: z.string().min(8, m.auth__password_min_length())
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: m.auth__passwords_no_match(),
          path: ["confirmPassword"]
        })
    }
  });

  if (isPending) {
    return <Spinner />;
  }

  if (signupsClosed) {
    return (
      <Container className={cn("flex max-w-md flex-col items-center gap-3 text-center", className)}>
        <Link href="/" className="flex flex-col items-center gap-2 font-medium">
          <LogoIcon className="flex size-8 items-center justify-center rounded-md" />
          <span className="sr-only">{appConfig.site.shortName}</span>
        </Link>
        <h1 className="text-xl font-bold">{m.auth__signups_closed_title()}</h1>
        <FieldDescription>{m.auth__signups_closed_description()}</FieldDescription>
        <Link to="/sign-in" search={{ redirect: redirectTo }} className="text-sm font-medium">
          {m.auth__sign_in_link()}
        </Link>
      </Container>
    );
  }

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
            <h1 className="text-xl font-bold">{m.auth__create_account_title()}</h1>
            <FieldDescription>
              {m.auth__already_have_account()}{" "}
              <Link to="/sign-in" search={{ redirect: redirectTo }}>
                {m.auth__sign_in_link()}
              </Link>
            </FieldDescription>
          </div>

          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{m.auth__name_label()}</FieldLabel>
                <Input
                  disabled={!isClient}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                  placeholder={m.auth__name_placeholder()}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-sm text-destructive" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </Field>
            )}
          </form.Field>

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
                <FieldLabel htmlFor={field.name}>{m.auth__password_label()}</FieldLabel>
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

          <form.Field name="confirmPassword">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{m.auth__confirm_password_label()}</FieldLabel>
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
              disabled={!isClient || signUpMutation.isPending || signUpMutation.isSuccess}
            >
              {signUpMutation.isPending ? m.auth__creating_account() : m.auth__create_account()}
            </Button>
          </Field>

          <OAuthButtons callbackUrl={callbackUrl} />
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {m.auth__terms_agreement()} <Link to="/terms-of-service">{m.auth__terms_of_service()}</Link>{" "}
        {m.auth__and()} <Link to="/privacy-policy">{m.auth__privacy_policy()}</Link>.
      </FieldDescription>
    </Container>
  );
}
