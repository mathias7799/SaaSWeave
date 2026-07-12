import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "#@/connection";
import {
  EMAIL_DELIVERY_PROVIDERS,
  type EmailDeliveryProvider,
  type EmailDeliveryStatus
} from "#@/schema/email.schema";
import { emailDelivery, emailTemplate } from "#@/schema/index";

export type { EmailDeliveryStatus } from "#@/schema/email.schema";

export type EmailCopyOverride = {
  subject: string | null;
  copy: Record<string, string>;
};

export type EmailDeliveryRecord = {
  templateKey: string;
  recipient: string;
  subject: string;
  status: EmailDeliveryStatus;
  provider: string;
  error?: string | null;
  organizationId?: string | null;
};

export type EmailDeliveryEntry = {
  id: string;
  templateKey: string;
  recipient: string;
  subject: string;
  status: string;
  provider: string;
  error: string | null;
  organizationId: string | null;
  createdAt: string;
};

/** Admin overrides (subject + copy) for one template key, or empty defaults. */
export async function getEmailCopy(key: string): Promise<EmailCopyOverride> {
  const [row] = await db.select().from(emailTemplate).where(eq(emailTemplate.key, key)).limit(1);
  return {
    copy: (row?.copy as Record<string, string> | null) ?? {},
    subject: row?.subject ?? null
  };
}

/** Persist admin overrides for a template key. */
export async function saveEmailCopy(
  key: string,
  subject: string | null,
  copy: Record<string, string>
): Promise<void> {
  await db
    .insert(emailTemplate)
    .values({ copy, key, subject, updatedAt: new Date() })
    .onConflictDoUpdate({
      set: { copy, subject, updatedAt: new Date() },
      target: emailTemplate.key
    });
}

/** Append a delivery-log row. Best-effort — never throws into the send flow. */
export async function recordEmailDelivery(record: EmailDeliveryRecord): Promise<void> {
  try {
    if (!EMAIL_DELIVERY_PROVIDERS.includes(record.provider as EmailDeliveryProvider)) return;

    await db.insert(emailDelivery).values({
      createdAt: new Date(),
      error: record.error ?? null,
      id: randomUUID(),
      organizationId: record.organizationId ?? null,
      provider: record.provider as EmailDeliveryProvider,
      recipient: record.recipient,
      status: record.status,
      subject: record.subject,
      templateKey: record.templateKey
    });
  } catch {
    // Delivery logging must never break sending.
  }
}

/** Most recent delivery-log rows, newest first, optionally filtered by template. */
export async function getEmailDeliveries(options?: {
  limit?: number;
  templateKey?: string;
}): Promise<EmailDeliveryEntry[]> {
  const limit = options?.limit ?? 25;
  const rows = await db
    .select()
    .from(emailDelivery)
    .where(options?.templateKey ? eq(emailDelivery.templateKey, options.templateKey) : undefined)
    .orderBy(desc(emailDelivery.createdAt))
    .limit(limit);

  return rows.map((row) => {
    return {
      createdAt: row.createdAt.toISOString(),
      error: row.error,
      id: row.id,
      organizationId: row.organizationId,
      provider: row.provider,
      recipient: row.recipient,
      status: row.status,
      subject: row.subject,
      templateKey: row.templateKey
    };
  });
}
