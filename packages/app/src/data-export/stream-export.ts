import { and, asc, eq, gt, inArray, or, type SQL, type SQLWrapper } from "drizzle-orm";

import {
  DATA_EXPORT_CHUNK_SIZE,
  MAX_DATA_EXPORT_BYTES,
  MAX_DATA_EXPORT_ROWS
} from "@saasweave/core/data-export/constants";
import { db, isDataExportCanceled, updateDataExportRequestStatus } from "@saasweave/db";
import {
  apiKey,
  auditLog,
  invitation,
  mediaAsset,
  member,
  notification,
  organization,
  usageEvent,
  user,
  webhookDelivery,
  webhookEndpoint
} from "@saasweave/db/schema";

import {
  buildDataExportNdjsonKey,
  cleanupDataExportWriter,
  createDataExportWriter,
  uploadDataExportFile
} from "#@/data-export/stream-writer";
import { stripSecretFields } from "#@/data-export/strip-secrets";

type KeysetCursor = { createdAt: string; id: string };

type ExportTableName =
  | "organization"
  | "members"
  | "invitations"
  | "api_keys"
  | "webhooks"
  | "webhook_deliveries"
  | "audit_logs"
  | "usage_events"
  | "notifications"
  | "media_assets";

const EXPORT_TABLE_ORDER: ExportTableName[] = [
  "organization",
  "members",
  "invitations",
  "api_keys",
  "webhooks",
  "webhook_deliveries",
  "audit_logs",
  "usage_events",
  "notifications",
  "media_assets"
];

function serializeDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function keysetWhere(
  tableCreatedAt: SQLWrapper,
  tableId: SQLWrapper,
  cursor: KeysetCursor | null
): SQL | undefined {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);
  return or(
    gt(tableCreatedAt, createdAt),
    and(eq(tableCreatedAt, createdAt), gt(tableId, cursor.id))
  );
}

function nextCursor<T extends { createdAt: Date; id: string }>(rows: T[]): KeysetCursor | null {
  const last = rows.at(-1);
  if (!last) return null;
  return { createdAt: last.createdAt.toISOString(), id: last.id };
}

export class DataExportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataExportLimitError";
  }
}

export type StreamExportResult = {
  bytesWritten: number;
  fileKey: string;
  rowsWritten: number;
};

export async function streamOrganizationDataExport(input: {
  organizationId: string;
  requestId: string;
}): Promise<StreamExportResult> {
  const writer = await createDataExportWriter(input.requestId);
  let rowsWritten = 0;
  let bytesWritten = 0;
  let cursor: KeysetCursor | null = null;

  const persistProgress = async () => {
    await updateDataExportRequestStatus(input.requestId, {
      bytesWritten,
      checkpoint: null,
      rowsWritten,
      status: "processing"
    });
  };

  const enforceLimits = () => {
    if (rowsWritten > MAX_DATA_EXPORT_ROWS) {
      throw new DataExportLimitError("export_row_limit_exceeded");
    }
    if (bytesWritten > MAX_DATA_EXPORT_BYTES) {
      throw new DataExportLimitError("export_byte_limit_exceeded");
    }
  };

  const writeRecord = async (table: ExportTableName, data: Record<string, unknown>) => {
    const line = stripSecretFields({ table, ...data }) as Record<string, unknown>;
    await writer.writeLine(line);
    rowsWritten += 1;
    bytesWritten = writer.bytesWritten;
    enforceLimits();
    if (rowsWritten % DATA_EXPORT_CHUNK_SIZE === 0) {
      await persistProgress();
      if (await isDataExportCanceled(input.requestId)) {
        throw new DataExportLimitError("export_canceled");
      }
    }
  };

  try {
    await writer.writeLine({
      exportedAt: new Date().toISOString(),
      format: "ndjson",
      organizationId: input.organizationId,
      table: "meta",
      version: 1
    });
    bytesWritten = writer.bytesWritten;

    for (let index = 0; index < EXPORT_TABLE_ORDER.length; index += 1) {
      const table = EXPORT_TABLE_ORDER[index]!;
      cursor = null;

      if (table === "organization") {
        const [orgRow] = await db
          .select()
          .from(organization)
          .where(eq(organization.id, input.organizationId))
          .limit(1);
        if (!orgRow) throw new Error("organization_not_found");
        await writeRecord(table, {
          data: {
            cancelAtPeriodEnd: orgRow.cancelAtPeriodEnd,
            createdAt: serializeDate(orgRow.createdAt),
            currentPeriodEnd: serializeDate(orgRow.currentPeriodEnd),
            id: orgRow.id,
            lastStripeEventAt: serializeDate(orgRow.lastStripeEventAt),
            logo: orgRow.logo,
            metadata: orgRow.metadata,
            name: orgRow.name,
            planId: orgRow.planId,
            slug: orgRow.slug,
            stripeCustomerId: orgRow.stripeCustomerId,
            stripeSubscriptionId: orgRow.stripeSubscriptionId,
            subscriptionStatus: orgRow.subscriptionStatus
          }
        });
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "members") {
        while (true) {
          const rows = await db
            .select({
              createdAt: member.createdAt,
              email: user.email,
              id: member.id,
              image: user.image,
              name: user.name,
              role: member.role,
              userId: member.userId
            })
            .from(member)
            .innerJoin(user, eq(member.userId, user.id))
            .where(
              and(
                eq(member.organizationId, input.organizationId),
                keysetWhere(member.createdAt, member.id, cursor)
              )
            )
            .orderBy(asc(member.createdAt), asc(member.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                createdAt: serializeDate(row.createdAt),
                email: row.email,
                id: row.id,
                image: row.image,
                name: row.name,
                role: row.role,
                userId: row.userId
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "invitations") {
        while (true) {
          const rows = await db
            .select({
              createdAt: invitation.createdAt,
              email: invitation.email,
              expiresAt: invitation.expiresAt,
              id: invitation.id,
              inviterId: invitation.inviterId,
              role: invitation.role,
              status: invitation.status
            })
            .from(invitation)
            .where(
              and(
                eq(invitation.organizationId, input.organizationId),
                keysetWhere(invitation.createdAt, invitation.id, cursor)
              )
            )
            .orderBy(asc(invitation.createdAt), asc(invitation.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                createdAt: serializeDate(row.createdAt),
                email: row.email,
                expiresAt: serializeDate(row.expiresAt),
                id: row.id,
                inviterId: row.inviterId,
                role: row.role,
                status: row.status
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "api_keys") {
        while (true) {
          const rows = await db
            .select({
              createdAt: apiKey.createdAt,
              createdBy: apiKey.createdBy,
              id: apiKey.id,
              keyPrefix: apiKey.keyPrefix,
              lastUsedAt: apiKey.lastUsedAt,
              name: apiKey.name,
              revokedAt: apiKey.revokedAt,
              scopes: apiKey.scopes
            })
            .from(apiKey)
            .where(
              and(
                eq(apiKey.organizationId, input.organizationId),
                keysetWhere(apiKey.createdAt, apiKey.id, cursor)
              )
            )
            .orderBy(asc(apiKey.createdAt), asc(apiKey.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                createdAt: serializeDate(row.createdAt),
                createdBy: row.createdBy,
                id: row.id,
                keyPrefix: row.keyPrefix,
                lastUsedAt: serializeDate(row.lastUsedAt),
                name: row.name,
                revokedAt: serializeDate(row.revokedAt),
                scopes: row.scopes
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "webhooks") {
        while (true) {
          const rows = await db
            .select({
              createdAt: webhookEndpoint.createdAt,
              enabled: webhookEndpoint.enabled,
              events: webhookEndpoint.events,
              id: webhookEndpoint.id,
              url: webhookEndpoint.url
            })
            .from(webhookEndpoint)
            .where(
              and(
                eq(webhookEndpoint.organizationId, input.organizationId),
                keysetWhere(webhookEndpoint.createdAt, webhookEndpoint.id, cursor)
              )
            )
            .orderBy(asc(webhookEndpoint.createdAt), asc(webhookEndpoint.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                createdAt: serializeDate(row.createdAt),
                enabled: row.enabled,
                events: row.events,
                id: row.id,
                url: row.url
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "webhook_deliveries") {
        const endpoints = await db
          .select({ id: webhookEndpoint.id })
          .from(webhookEndpoint)
          .where(eq(webhookEndpoint.organizationId, input.organizationId));
        const endpointIds = endpoints.map((entry) => entry.id);
        if (endpointIds.length === 0) {
          continue;
        }

        while (true) {
          const rows = await db
            .select({
              attempt: webhookDelivery.attempt,
              createdAt: webhookDelivery.createdAt,
              endpointId: webhookDelivery.endpointId,
              eventType: webhookDelivery.eventType,
              id: webhookDelivery.id,
              payload: webhookDelivery.payload,
              responseBody: webhookDelivery.responseBody,
              responseStatus: webhookDelivery.responseStatus,
              status: webhookDelivery.status
            })
            .from(webhookDelivery)
            .where(
              and(
                inArray(webhookDelivery.endpointId, endpointIds),
                keysetWhere(webhookDelivery.createdAt, webhookDelivery.id, cursor)
              )
            )
            .orderBy(asc(webhookDelivery.createdAt), asc(webhookDelivery.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                attempt: row.attempt,
                createdAt: serializeDate(row.createdAt),
                endpointId: row.endpointId,
                eventType: row.eventType,
                id: row.id,
                payload: row.payload,
                responseBody: row.responseBody,
                responseStatus: row.responseStatus,
                status: row.status
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "audit_logs") {
        while (true) {
          const rows = await db
            .select({
              action: auditLog.action,
              actorId: auditLog.actorId,
              actorName: auditLog.actorName,
              createdAt: auditLog.createdAt,
              id: auditLog.id,
              metadata: auditLog.metadata,
              targetLabel: auditLog.targetLabel,
              targetType: auditLog.targetType
            })
            .from(auditLog)
            .where(
              and(
                eq(auditLog.organizationId, input.organizationId),
                keysetWhere(auditLog.createdAt, auditLog.id, cursor)
              )
            )
            .orderBy(asc(auditLog.createdAt), asc(auditLog.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                action: row.action,
                actorId: row.actorId,
                actorName: row.actorName,
                createdAt: serializeDate(row.createdAt),
                id: row.id,
                metadata: row.metadata,
                targetLabel: row.targetLabel,
                targetType: row.targetType
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "usage_events") {
        while (true) {
          const rows = await db
            .select()
            .from(usageEvent)
            .where(
              and(
                eq(usageEvent.organizationId, input.organizationId),
                keysetWhere(usageEvent.createdAt, usageEvent.id, cursor)
              )
            )
            .orderBy(asc(usageEvent.createdAt), asc(usageEvent.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                createdAt: serializeDate(row.createdAt),
                feature: row.feature,
                id: row.id,
                inputTokens: row.inputTokens,
                metric: row.metric,
                model: row.model,
                outputTokens: row.outputTokens,
                provider: row.provider,
                quantity: row.quantity
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "notifications") {
        while (true) {
          const rows = await db
            .select({
              actionUrl: notification.actionUrl,
              body: notification.body,
              createdAt: notification.createdAt,
              id: notification.id,
              readAt: notification.readAt,
              title: notification.title,
              type: notification.type,
              userId: notification.userId
            })
            .from(notification)
            .where(
              and(
                eq(notification.organizationId, input.organizationId),
                keysetWhere(notification.createdAt, notification.id, cursor)
              )
            )
            .orderBy(asc(notification.createdAt), asc(notification.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                actionUrl: row.actionUrl,
                body: row.body,
                createdAt: serializeDate(row.createdAt),
                id: row.id,
                readAt: serializeDate(row.readAt),
                title: row.title,
                type: row.type,
                userId: row.userId
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
        continue;
      }

      if (table === "media_assets") {
        const members = await db
          .select({ userId: member.userId })
          .from(member)
          .where(eq(member.organizationId, input.organizationId));
        const memberUserIds = members.map((entry) => entry.userId);
        if (memberUserIds.length === 0) {
          continue;
        }

        while (true) {
          const rows = await db
            .select({
              contentType: mediaAsset.contentType,
              createdAt: mediaAsset.createdAt,
              id: mediaAsset.id,
              key: mediaAsset.key,
              linkedAt: mediaAsset.linkedAt,
              ownerId: mediaAsset.ownerId,
              purpose: mediaAsset.purpose,
              replacedAt: mediaAsset.replacedAt,
              size: mediaAsset.size,
              status: mediaAsset.status,
              uploadedAt: mediaAsset.uploadedAt
            })
            .from(mediaAsset)
            .where(
              and(
                inArray(mediaAsset.ownerId, memberUserIds),
                keysetWhere(mediaAsset.createdAt, mediaAsset.id, cursor)
              )
            )
            .orderBy(asc(mediaAsset.createdAt), asc(mediaAsset.id))
            .limit(DATA_EXPORT_CHUNK_SIZE);

          for (const row of rows) {
            await writeRecord(table, {
              data: {
                contentType: row.contentType,
                createdAt: serializeDate(row.createdAt),
                id: row.id,
                key: row.key,
                linkedAt: serializeDate(row.linkedAt),
                ownerId: row.ownerId,
                purpose: row.purpose,
                replacedAt: serializeDate(row.replacedAt),
                size: row.size,
                status: row.status,
                uploadedAt: serializeDate(row.uploadedAt)
              }
            });
          }

          cursor = nextCursor(rows);
          if (!cursor) break;
        }
        cursor = null;
        await persistProgress();
      }
    }

    await writer.close();
    bytesWritten = writer.bytesWritten;
    const fileKey = buildDataExportNdjsonKey(input.organizationId, input.requestId);
    await uploadDataExportFile(fileKey, writer.path);

    return { bytesWritten, fileKey, rowsWritten };
  } finally {
    await cleanupDataExportWriter(writer.path);
  }
}
