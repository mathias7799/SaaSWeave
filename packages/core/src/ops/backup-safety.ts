/** Safety gate rules mirrored by scripts/ops/backup-restore-verify.mjs */
export const BACKUP_RESTORE_LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "postgres",
  "host.docker.internal"
]);

export function assertLocalDatabaseTarget(databaseUrl: string, allowRemote = false): void {
  const host = new URL(databaseUrl).hostname;
  if (!BACKUP_RESTORE_LOCAL_HOSTS.has(host) && !allowRemote) {
    throw new Error(`Refusing non-local database host "${host}"`);
  }
}
