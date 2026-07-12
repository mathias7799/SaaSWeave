import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@saasweave/auth/react/auth-client";
import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { useNavigate } from "@saasweave/i18n/tanstack-start/hooks/use-navigate";
import { Button } from "@saasweave/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@saasweave/ui/components/field";
import { Input } from "@saasweave/ui/components/input";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";
import { cn } from "@saasweave/ui/lib/utils";

import { Container } from "@/shared/ui/container";
import { LogoIcon } from "@/shared/ui/logo";

import { appConfig } from "@/config/app.config";

export function ResetPasswordForm({
  token,
  className,
  ...props
}: React.ComponentProps<"div"> & { token?: string }) {
  const navigate = useNavigate();
  const isClient = useIsClient();

  const mutation = useMutation({
    mutationFn: async (values: { newPassword: string }) => {
      if (!token) throw new Error(m.auth__reset_password_invalid_token());
      const result = await authClient.resetPassword({ newPassword: values.newPassword, token });
      if (result.error) throw new Error(result.error.message ?? m.auth__reset_password_failed());
    },
    onError: (error: Error) => toast.error(error.message || m.auth__reset_password_failed()),
    onSuccess: async () => {
      toast.success(m.auth__reset_password_successful());
      await navigate({ to: "/sign-in" });
    }
  });

  const form = useForm({
    defaultValues: { confirmPassword: "", newPassword: "" },
    onSubmit: async ({ value }) => {
      mutation.mutate({ newPassword: value.newPassword });
    },
    validators: {
      onSubmit: z
        .object({
          confirmPassword: z.string(),
          newPassword: z.string().min(8, m.auth__password_min_length())
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: m.auth__passwords_no_match(),
          path: ["confirmPassword"]
        })
    }
  });

  if (!token) {
    return (
      <Container className={cn("flex max-w-md flex-col items-center gap-3 text-center", className)}>
        <Link href="/" className="flex flex-col items-center gap-2 font-medium">
          <LogoIcon className="flex size-8 items-center justify-center rounded-md" />
          <span className="sr-only">{appConfig.site.shortName}</span>
        </Link>
        <h1 className="text-xl font-bold">{m.auth__reset_password_invalid_token()}</h1>
        <Link to="/forgot-password" className="text-sm font-medium">
          {m.auth__forgot_password_link()}
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
            <h1 className="text-xl font-bold">{m.auth__reset_password_title()}</h1>
            <FieldDescription>{m.auth__reset_password_description()}</FieldDescription>
          </div>

          <form.Field name="newPassword">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{m.auth__new_password_label()}</FieldLabel>
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
            <Button light="skeuomorphic" type="submit" disabled={!isClient || mutation.isPending}>
              {mutation.isPending ? m.auth__resetting_password() : m.auth__reset_password_button()}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </Container>
  );
}
