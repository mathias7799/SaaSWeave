import { defineRelationsPart } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  // Admin plugin fields
  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false)
});

export const session = pgTable(
  "session",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Organization plugin: the session's active organization
    activeOrganizationId: text("active_organization_id"),
    // Admin plugin: set while an operator impersonates a user
    impersonatedBy: text("impersonated_by")
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    value: text("value").notNull()
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const twoFactor = pgTable(
  "two_factor",
  {
    backupCodes: text("backup_codes").notNull(),
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true)
  },
  (table) => [index("two_factor_userId_idx").on(table.userId)]
);

// #region Organization plugin

export const organization = pgTable("organization", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: text("id").primaryKey(),
  logo: text("logo"),
  metadata: text("metadata"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Stripe billing state (populated by the Stripe webhook when configured)
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planId: text("plan_id"),
  subscriptionStatus: text("subscription_status"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  /** Stripe event.created of the last webhook applied for this org's customer. */
  lastStripeEventAt: timestamp("last_stripe_event_at")
});

export const member = pgTable(
  "member",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId)
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    teamId: text("team_id")
  },
  (table) => [index("invitation_organizationId_idx").on(table.organizationId)]
);

export const relations = defineRelationsPart(
  { account, invitation, member, organization, session, twoFactor, user, verification },
  (r) => {
    return {
      account: {
        user: r.one.user({
          from: r.account.userId,
          to: r.user.id
        })
      },
      invitation: {
        inviter: r.one.user({
          from: r.invitation.inviterId,
          to: r.user.id
        }),
        organization: r.one.organization({
          from: r.invitation.organizationId,
          to: r.organization.id
        })
      },
      member: {
        organization: r.one.organization({
          from: r.member.organizationId,
          to: r.organization.id
        }),
        user: r.one.user({
          from: r.member.userId,
          to: r.user.id
        })
      },
      organization: {
        invitations: r.many.invitation({
          from: r.organization.id,
          to: r.invitation.organizationId
        }),
        members: r.many.member({
          from: r.organization.id,
          to: r.member.organizationId
        })
      },
      session: {
        user: r.one.user({
          from: r.session.userId,
          to: r.user.id
        })
      },
      twoFactor: {
        user: r.one.user({
          from: r.twoFactor.userId,
          to: r.user.id
        })
      },
      user: {
        accounts: r.many.account({
          from: r.user.id,
          to: r.account.userId
        }),
        memberships: r.many.member({
          from: r.user.id,
          to: r.member.userId
        }),
        sessions: r.many.session({
          from: r.user.id,
          to: r.session.userId
        }),
        twoFactors: r.many.twoFactor({
          from: r.user.id,
          to: r.twoFactor.userId
        })
      }
    };
  }
);
