import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  assertAvatarUpload,
  completeMediaAssetUpload,
  createMediaAssetUpload,
  finalizeAvatarReplacement
} from "@saasweave/app/storage/media-asset";
import { db } from "@saasweave/db";
import { user } from "@saasweave/db/schema";

import { protectedProcedure } from "#@/lib/procedures/factory";

export const profileRouter = {
  get: protectedProcedure
    .route({ description: "The caller's account profile", method: "GET" })
    .handler(async ({ context }) => {
      const rows = await db
        .select({ image: user.image })
        .from(user)
        .where(eq(user.id, context.session.user.id))
        .limit(1);
      return {
        email: context.session.user.email,
        id: context.session.user.id,
        image: rows[0]?.image ?? null,
        name: context.session.user.name,
        role: context.session.user.role
      };
    }),

  update: protectedProcedure
    .route({ description: "Update the caller's display name", method: "POST" })
    .input(z.object({ name: z.string().min(1).max(120) }))
    .handler(async ({ context, input }) => {
      await db.update(user).set({ name: input.name }).where(eq(user.id, context.session.user.id));
      return { ok: true };
    }),

  requestAvatarUpload: protectedProcedure
    .route({ description: "Request a signed upload contract for a profile avatar", method: "POST" })
    .errors({ INVALID_UPLOAD: { description: "Avatar upload is not allowed", status: 400 } })
    .input(
      z.object({
        contentType: z.string().min(1),
        fileName: z.string().min(1).max(180),
        size: z.number().int().positive()
      })
    )
    .handler(async ({ context, errors, input }) => {
      try {
        assertAvatarUpload(input);
        return await createMediaAssetUpload({
          contentType: input.contentType,
          fileName: input.fileName,
          ownerId: context.session.user.id,
          purpose: "avatar",
          size: input.size
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === "Avatar must be a JPEG, PNG, or WebP image." ||
            error.message === "Avatar must be 2 MB or smaller.")
        ) {
          throw errors.INVALID_UPLOAD();
        }
        throw error;
      }
    }),

  completeAvatarUpload: protectedProcedure
    .route({
      description: "Finalize an avatar upload and attach it to the profile",
      method: "POST"
    })
    .errors({ UPLOAD_NOT_READY: { description: "Upload not found or incomplete", status: 400 } })
    .input(z.object({ mediaAssetId: z.string().uuid() }))
    .handler(async ({ context, errors, input }) => {
      const result = await completeMediaAssetUpload({
        assetId: input.mediaAssetId,
        ownerId: context.session.user.id
      });
      if (!result) throw errors.UPLOAD_NOT_READY();
      await db.update(user).set({ image: result.url }).where(eq(user.id, context.session.user.id));
      await finalizeAvatarReplacement(context.session.user.id, input.mediaAssetId);
      return { image: result.url, ok: true };
    })
};
