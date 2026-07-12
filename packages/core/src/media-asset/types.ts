import { z } from "zod";

import { MEDIA_ASSET_PURPOSES, MEDIA_ASSET_STATUSES } from "#@/media-asset/constants";

export const mediaAssetPurposeSchema = z.enum(MEDIA_ASSET_PURPOSES);
export const mediaAssetStatusSchema = z.enum(MEDIA_ASSET_STATUSES);

export const mediaAssetSchema = z.object({
  contentType: z.string().min(1),
  id: z.string().uuid(),
  key: z.string().min(1),
  linkedAt: z.date().nullable(),
  ownerId: z.string().min(1),
  purpose: mediaAssetPurposeSchema,
  size: z.number().int().nonnegative(),
  status: mediaAssetStatusSchema,
  uploadedAt: z.date().nullable()
});

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type MediaAssetPurpose = z.infer<typeof mediaAssetPurposeSchema>;
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>;

export const mediaAssetUploadRequestSchema = z.object({
  contentType: z.string().min(1),
  fileName: z.string().min(1).max(180),
  purpose: mediaAssetPurposeSchema,
  size: z.number().int().positive().max(8_000_000)
});

export const uploadContractSchema = z.discriminatedUnion("method", [
  z.object({
    headers: z.record(z.string(), z.string()).optional(),
    method: z.literal("PUT"),
    url: z.string().url()
  }),
  z.object({
    fields: z.record(z.string(), z.string()),
    method: z.literal("POST"),
    url: z.string().url()
  })
]);

export const mediaAssetUploadResultSchema = z.object({
  contract: uploadContractSchema,
  contentType: z.string().min(1),
  key: z.string().min(1),
  maxSize: z.number().int().positive(),
  mediaAssetId: z.string().uuid(),
  purpose: mediaAssetPurposeSchema
});

export type MediaAssetUploadRequest = z.infer<typeof mediaAssetUploadRequestSchema>;
export type MediaAssetUploadResult = z.infer<typeof mediaAssetUploadResultSchema>;
