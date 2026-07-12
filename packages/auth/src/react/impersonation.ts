import { authClient } from "#@/react/auth-client";

export async function impersonateWorkspaceMember(userId: string, organizationId?: string) {
  const result = await authClient.$fetch("/workspace/impersonate", {
    body: { organizationId, userId },
    method: "POST"
  });

  if (result.error) {
    throw new Error(result.error.message ?? "Could not impersonate member.");
  }

  return result.data;
}

export async function impersonatePlatformUser(userId: string) {
  const result = await authClient.admin.impersonateUser({ userId });
  if (result.error) {
    throw new Error(result.error.message ?? "Could not impersonate user.");
  }
  return result.data;
}

export async function stopImpersonating() {
  const result = await authClient.admin.stopImpersonating();
  if (result.error) {
    throw new Error(result.error.message ?? "Could not stop impersonating.");
  }
  return result.data;
}
