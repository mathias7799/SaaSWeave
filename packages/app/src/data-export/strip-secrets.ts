const SECRET_FIELD_NAMES = new Set([
  "keyHash",
  "key_hash",
  "secret",
  "password",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
  "backupCodes",
  "backup_codes"
]);

/** Strip known secret fields from export payloads (defense in depth). */
export function stripSecretFields<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => stripSecretFields(entry)) as T;
  }

  if (typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELD_NAMES.has(key)) {
      continue;
    }
    output[key] = stripSecretFields(entry);
  }

  return output as T;
}
