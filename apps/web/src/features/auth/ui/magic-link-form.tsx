import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@saasweave/auth/react/auth-client";
import { m } from "@saasweave/i18n/messages";
import { Button } from "@saasweave/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldSeparator
} from "@saasweave/ui/components/field";
import { Input } from "@saasweave/ui/components/input";

export function MagicLinkForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = z.email().safeParse(email);
      if (!parsed.success) {
        throw new Error(m.auth__invalid_email());
      }
      const result = await authClient.signIn.magicLink({
        callbackURL: callbackUrl,
        email: parsed.data
      });
      if (result.error) {
        throw new Error(result.error.message ?? m.auth__magic_link_failed());
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || m.auth__magic_link_failed());
    },
    onSuccess: () => setSent(true)
  });

  if (sent) {
    return (
      <>
        <FieldSeparator>{m.auth__or()}</FieldSeparator>
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center text-sm">
          <p className="font-medium text-foreground">{m.auth__magic_link_sent_title()}</p>
          <p className="mt-1 text-muted-foreground">
            {m.auth__magic_link_sent_description({ email })}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <FieldSeparator>{m.auth__or()}</FieldSeparator>
      <Field>
        <FieldLabel htmlFor="magic-link-email">{m.auth__email_label()}</FieldLabel>
        <Input
          id="magic-link-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder={m.auth__email_placeholder()}
          type="email"
          value={email}
        />
        <FieldDescription>{m.auth__magic_link_description()}</FieldDescription>
      </Field>
      <Field>
        <Button
          disabled={!email.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          type="button"
          variant="outline"
        >
          {mutation.isPending ? m.auth__magic_link_sending() : m.auth__magic_link_send()}
        </Button>
      </Field>
    </>
  );
}
