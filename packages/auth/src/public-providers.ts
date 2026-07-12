import { isFeatureGloballyEnabled } from "@saasweave/db";

export type OAuthProviderEnv = {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export async function getPublicAuthProviderFlags(env: OAuthProviderEnv) {
  const magicLink = await isFeatureGloballyEnabled("magic_link");
  return {
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    magicLink
  };
}
