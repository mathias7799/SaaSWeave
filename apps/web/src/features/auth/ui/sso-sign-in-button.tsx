import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@saasweave/auth/react/auth-client";
import { m } from "@saasweave/i18n/messages";
import { Button } from "@saasweave/ui/components/button";

export function SsoSignInButton({ callbackUrl, email }: { callbackUrl: string; email?: string }) {
  const [pending, setPending] = useState(false);

  async function signInWithSso() {
    setPending(true);
    try {
      const result = await authClient.signIn.sso({
        callbackURL: callbackUrl,
        email: email?.includes("@") ? email : undefined
      });
      if (result.error) throw new Error(result.error.message);
      if (result.data?.url) window.location.assign(result.data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.auth__sign_in_failed());
    } finally {
      setPending(false);
    }
  }

  return (
    <Button disabled={pending} onClick={signInWithSso} type="button" variant="outline">
      {pending ? m.auth__signing_in() : m.auth__continue_with_sso()}
    </Button>
  );
}
