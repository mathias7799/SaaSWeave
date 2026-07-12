import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { db } from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

async function getViolatedConstraint(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name;
  }
}

describe.sequential("persisted domain constraints", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects unsupported batch and export values", async () => {
    const seed = await seedOrgWithOwner();

    expect(
      await getViolatedConstraint(
        db.execute(sql`
        INSERT INTO batch_job (
          id, organization_id, created_by_user_id, type, status, total_items
        ) VALUES (
          ${randomUUID()}, ${seed.organizationId}, ${seed.userId}, 'unknown', 'pending', 0
        )
        `)
      )
    ).toBe("batch_job_type_check");

    expect(
      await getViolatedConstraint(
        db.execute(sql`
        INSERT INTO data_export_request (
          id, organization_id, requested_by_user_id, status, format
        ) VALUES (
          ${randomUUID()}, ${seed.organizationId}, ${seed.userId}, 'pending', 'zip'
        )
        `)
      )
    ).toBe("data_export_request_format_check");
  });

  it("rejects obsolete media purposes and invalid delivery states", async () => {
    const seed = await seedOrgWithOwner();

    expect(
      await getViolatedConstraint(
        db.execute(sql`
        INSERT INTO media_asset (
          id, owner_id, purpose, status, key, content_type, size
        ) VALUES (
          ${randomUUID()}, ${seed.userId}, 'export', 'pending', ${`exports/${randomUUID()}`},
          'application/x-ndjson', 1
        )
        `)
      )
    ).toBe("media_asset_purpose_check");

    expect(
      await getViolatedConstraint(
        db.execute(sql`
        INSERT INTO email_delivery (
          id, template_key, recipient, subject, status, provider
        ) VALUES (
          ${randomUUID()}, 'welcome', 'person@example.test', 'Welcome', 'queued', 'console'
        )
        `)
      )
    ).toBe("email_delivery_status_check");

    expect(
      await getViolatedConstraint(
        db.execute(sql`
        INSERT INTO email_delivery (
          id, template_key, recipient, subject, status, provider
        ) VALUES (
          ${randomUUID()}, 'welcome', 'person@example.test', 'Welcome', 'sent', 'unknown'
        )
        `)
      )
    ).toBe("email_delivery_provider_check");
  });

  it("rejects invalid webhook delivery states", async () => {
    const seed = await seedOrgWithOwner();
    const endpointId = randomUUID();

    await db.execute(sql`
      INSERT INTO webhook_endpoint (
        id, organization_id, url, events, secret
      ) VALUES (
        ${endpointId}, ${seed.organizationId}, 'https://example.com/hook', '[]'::jsonb, 'secret'
      )
    `);

    expect(
      await getViolatedConstraint(
        db.execute(sql`
        INSERT INTO webhook_delivery (
          id, endpoint_id, event_type, payload, attempt, status
        ) VALUES (
          ${randomUUID()}, ${endpointId}, 'usage.recorded', '{}'::jsonb, '1', 'pending'
        )
        `)
      )
    ).toBe("webhook_delivery_status_check");
  });

  it("indexes only audit rows eligible for automated retention", async () => {
    const rows = await db.execute<{ indexdef: string }>(sql`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'audit_log'
        AND indexname = 'audit_log_retention_candidate_idx'
    `);

    expect(rows).toHaveLength(1);
    const definition = rows[0]?.indexdef ?? "";
    expect(definition).toContain("auth.%");
    expect(definition).toContain("security.%");
    expect(definition).toContain("api_key.%");
    expect(definition).toContain("sso.%");
    expect(definition).toContain("billing.%");
  });
});
