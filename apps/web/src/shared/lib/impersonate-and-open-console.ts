import { toast } from "sonner";

import { impersonatePlatformUser } from "@saasweave/auth/react/impersonation";

export async function impersonateAndOpenConsole(userId: string): Promise<void> {
  try {
    await impersonatePlatformUser(userId);
    window.location.assign("/app");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not impersonate user");
  }
}
