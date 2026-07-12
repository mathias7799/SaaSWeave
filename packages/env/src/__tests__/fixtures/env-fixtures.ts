import { vi } from "vite-plus/test";

export const productionEnvBase = {
  BETTER_AUTH_SECRET: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  DATABASE_URL: "postgresql://postgres:changeme@localhost:5432/saasweave",
  IS_BUILD: "false",
  NODE_ENV: "production",
  PLATFORM_ADMIN_EMAILS: "admin@example.com",
  VITE_SERVER_URL: "http://localhost:5000/server",
  VITE_WEB_URL: "http://localhost:3000"
} as const;

export const developmentWebEnvBase = {
  NODE_ENV: "development",
  VITE_SERVER_URL: "http://localhost:5000/server",
  VITE_WEB_URL: "http://localhost:3000"
} as const;

let isProductionMode = false;

export function setIsProductionMode(value: boolean): void {
  isProductionMode = value;
}

export function getIsProductionMode(): boolean {
  return isProductionMode;
}

vi.mock("std-env", () => {
  return {
    get isProduction() {
      return getIsProductionMode();
    }
  };
});

export function stubEnvValues(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      vi.stubEnv(key, "");
      delete process.env[key];
      continue;
    }
    vi.stubEnv(key, value);
  }
}

export function stubProductionEnv(overrides: Record<string, string | undefined> = {}): void {
  stubEnvValues({ ...productionEnvBase, ...overrides });
}

export function stubDevelopmentWebEnv(overrides: Record<string, string | undefined> = {}): void {
  stubEnvValues({ ...developmentWebEnvBase, ...overrides });
}
