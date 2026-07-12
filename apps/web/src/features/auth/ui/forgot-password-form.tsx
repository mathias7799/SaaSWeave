import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { authClient } from "@saasweave/auth/react/auth-client";
import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { Button } from "@saasweave/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@saasweave/ui/components/field";
import { Input } from "@saasweave/ui/components/input";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";
import { cn } from "@saasweave/ui/lib/utils";

import { Container } from "@/shared/ui/container";
import { LogoIcon } from "@/shared/ui/logo";

import { appConfig } from "@/config/app.config";

export function ForgotPasswordForm({ className, ...props }: React.ComponentProps<"div">) {
  const isClient = useIsClient();
  const resetUrl = new URL("/reset-password", appConfig.site.url).href;
  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: resetUrl
      });
      if (result.error) throw new Error(result.error.message ?? m.auth__request_reset_failed());
      return email;
    }
  });

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      mutation.mutate(value.email);
    },
    validators: {
      onSubmit: z.object({ email: z.email(m.auth__invalid_email()) })
    }
  });

  if (mutation.isSuccess) {
    return (
      <Container className={cn("flex max-w-md flex-col items-center gap-3 text-center", className)}>
        <Link href="/" className="flex flex-col items-center gap-2 font-medium">
          <LogoIcon className="flex size-8 items-center justify-center rounded-md" />
          <span className="sr-only">{appConfig.site.shortName}</span>
        </Link>
        <h1 className="text-xl font-bold">{m.auth__reset_link_sent_title()}</h1>
        <FieldDescription>
          {m.auth__reset_link_sent_description({ email: mutation.data })}
        </FieldDescription>
        <Link to="/sign-in" className="text-sm font-medium">
          {m.auth__back_to_sign_in()}
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
            <h1 className="text-xl font-bold">{m.auth__forgot_password_title()}</h1>
            <FieldDescription>{m.auth__forgot_password_description()}</FieldDescription>
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

          <Field>
            <Button light="skeuomorphic" type="submit" disabled={!isClient || mutation.isPending}>
              {mutation.isPending ? m.auth__sending_reset_link() : m.auth__send_reset_link()}
            </Button>
          </Field>

          <FieldDescription className="text-center">
            <Link to="/sign-in">{m.auth__back_to_sign_in()}</Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </Container>
  );
}
