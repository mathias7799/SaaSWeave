#!/usr/bin/env node
import { execFileSync } from "node:child_process";
/**
 * Backup → restore → integrity verification drill for local/CI Postgres.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "postgres", "host.docker.internal"]);

function parseDatabaseUrl(urlString) {
  const url = new URL(urlString);
  return {
    database: url.pathname.replace(/^\//, ""),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: url.port || "5432",
    user: decodeURIComponent(url.username)
  };
}

function assertLocalTarget(databaseUrl) {
  const allowRemote = process.env.BACKUP_RESTORE_ALLOW_REMOTE === "true";
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host) && !allowRemote) {
    console.error(
      `Refusing backup/restore against non-local host "${host}". Set BACKUP_RESTORE_ALLOW_REMOTE=true to override intentionally.`
    );
    process.exit(2);
  }
}

function run(cmd, args, env = process.env) {
  execFileSync(cmd, args, { stdio: "inherit", env });
}

function runCapture(cmd, args, env = process.env) {
  return execFileSync(cmd, args, { encoding: "utf8", env }).trim();
}

function psql(databaseUrl, sql) {
  const cfg = parseDatabaseUrl(databaseUrl);
  return runCapture(
    "psql",
    [
      "-h",
      cfg.host,
      "-p",
      cfg.port,
      "-U",
      cfg.user,
      "-d",
      cfg.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      sql
    ],
    { ...process.env, PGPASSWORD: cfg.password }
  );
}

function buildRestoreUrl(sourceUrl, restoreDbName) {
  const url = new URL(sourceUrl);
  url.pathname = `/${restoreDbName}`;
  return url.toString();
}

function checksum(value) {
  return createHash("sha256").update(value).digest("hex");
}

function main() {
  for (const tool of ["psql", "pg_dump", "pg_restore"]) {
    try {
      execFileSync("which", [tool], { stdio: "ignore" });
    } catch {
      console.error(`${tool} is required for backup/restore verification`);
      process.exit(1);
    }
  }

  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  assertLocalTarget(sourceUrl);

  const cfg = parseDatabaseUrl(sourceUrl);
  const markerId = `backup-drill-${Date.now()}`;
  const markerAction = "ops.backup_drill.marker";
  const tempDir = mkdtempSync(join(tmpdir(), "tsu-backup-drill-"));
  const dumpPath = join(tempDir, "backup.sql");
  const restoreDb = `${cfg.database}_restore_${Date.now()}`;

  try {
    console.log("Creating disposable audit marker row…");
    psql(
      sourceUrl,
      `INSERT INTO audit_log (id, action, actor_name, created_at) VALUES ('${markerId}', '${markerAction}', 'backup-drill', NOW());`
    );

    const sourceCount = psql(sourceUrl, `SELECT COUNT(*) FROM audit_log WHERE id = '${markerId}';`);
    if (sourceCount !== "1") {
      throw new Error(`Expected marker row count 1, got ${sourceCount}`);
    }

    const sourceChecksum = psql(
      sourceUrl,
      `SELECT COALESCE(md5(string_agg(id || action || COALESCE(actor_name, ''), '' ORDER BY id)), '') FROM audit_log WHERE id = '${markerId}';`
    );

    console.log("Dumping source database with pg_dump…");
    run(
      "pg_dump",
      [
        "-h",
        cfg.host,
        "-p",
        cfg.port,
        "-U",
        cfg.user,
        "-d",
        cfg.database,
        "--format=custom",
        "--file",
        dumpPath,
        "--no-owner",
        "--no-privileges"
      ],
      { ...process.env, PGPASSWORD: cfg.password }
    );

    const dumpBytes = readFileSync(dumpPath);
    if (dumpBytes.length < 128) {
      throw new Error("Backup artifact is unexpectedly small — refusing to treat as valid backup");
    }
    const dumpChecksum = checksum(dumpBytes);
    console.log(`Backup artifact checksum: ${dumpChecksum}`);

    console.log(`Creating isolated restore database ${restoreDb}…`);
    runCapture(
      "psql",
      [
        "-h",
        cfg.host,
        "-p",
        cfg.port,
        "-U",
        cfg.user,
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `CREATE DATABASE "${restoreDb}";`
      ],
      { ...process.env, PGPASSWORD: cfg.password }
    );

    console.log("Restoring backup into isolated database…");
    run(
      "pg_restore",
      [
        "-h",
        cfg.host,
        "-p",
        cfg.port,
        "-U",
        cfg.user,
        "-d",
        restoreDb,
        "--clean",
        "--if-exists",
        "--no-owner",
        dumpPath
      ],
      { ...process.env, PGPASSWORD: cfg.password }
    );

    const restoreUrl = buildRestoreUrl(sourceUrl, restoreDb);
    const restoreCount = psql(
      restoreUrl,
      `SELECT COUNT(*) FROM audit_log WHERE id = '${markerId}';`
    );
    if (restoreCount !== "1") {
      throw new Error(`Restore integrity failed: marker row count ${restoreCount}`);
    }

    const restoreChecksum = psql(
      restoreUrl,
      `SELECT COALESCE(md5(string_agg(id || action || COALESCE(actor_name, ''), '' ORDER BY id)), '') FROM audit_log WHERE id = '${markerId}';`
    );
    if (restoreChecksum !== sourceChecksum) {
      throw new Error(
        `Restore checksum mismatch: source=${sourceChecksum} restore=${restoreChecksum}`
      );
    }

    console.log("Cleaning up marker row from source database…");
    psql(sourceUrl, `DELETE FROM audit_log WHERE id = '${markerId}';`);

    console.log("Backup/restore drill passed.");
  } finally {
    try {
      runCapture(
        "psql",
        [
          "-h",
          cfg.host,
          "-p",
          cfg.port,
          "-U",
          cfg.user,
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          `DROP DATABASE IF EXISTS "${restoreDb}" WITH (FORCE);`
        ],
        { ...process.env, PGPASSWORD: cfg.password }
      );
    } catch {
      // Best-effort cleanup for CI/local disposable DBs.
    }
    rmSync(tempDir, { force: true, recursive: true });
  }
}

main();
