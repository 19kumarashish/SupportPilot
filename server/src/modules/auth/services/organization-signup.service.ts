import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, lte, or, sql } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { organizations } from "../../../infrastructure/database/schema/organizations.js";
import { users } from "../../../infrastructure/database/schema/users.js";
import { pendingOrganizationSignups } from "../../../db/schema/pending-organization-signups.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { logger } from "../../../infrastructure/logger/index.js";
import { hashPassword } from "../../../shared/security/password.js";
import { hashToken } from "../../../shared/security/token.js";
import type { OrganizationSignupInput } from "../validators/auth.validators.js";
import type { ResendOrganizationSignupVerificationInput } from "../validators/auth.validators.js";
import { getVerificationUrl } from "./email-provider.js";
import { deliverVerificationEmail } from "../../../workers/jobs.js";

const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

class VerificationEmailDeliveryError extends Error {}

const uniqueConflictCodes = new Set([
  "pending_organization_signups_email_unique",
  "pending_organization_signups_slug_unique",
  "organizations_slug_unique",
  "users_organization_email_unique",
]);

const getUniqueConstraint = (error: unknown): string | undefined => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    if (
      "code" in current &&
      current.code === "23505" &&
      "constraint" in current &&
      typeof current.constraint === "string"
    ) {
      return current.constraint;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return undefined;
};

const isSignupConflict = (error: unknown): boolean => {
  const constraint = getUniqueConstraint(error);
  return constraint !== undefined && uniqueConflictCodes.has(constraint);
};

export const organizationSignupService = {
  async begin(input: OrganizationSignupInput): Promise<void> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + VERIFICATION_LIFETIME_MS);
    const pendingId = randomUUID();

    try {
      await db.transaction(async (transaction) => {
        const [existingOrganization] = await transaction
          .select({ id: organizations.id })
          .from(organizations)
          .where(
            sql`lower(${organizations.slug}) = ${input.organizationSlug}`,
          )
          .limit(1);

        if (existingOrganization) {
          throw new AppError(
            409,
            "SIGNUP_ALREADY_EXISTS",
            "A workspace with this slug already exists",
          );
        }

        await transaction
          .delete(pendingOrganizationSignups)
          .where(
            and(
              lte(pendingOrganizationSignups.expiresAt, new Date()),
              or(
                eq(
                  pendingOrganizationSignups.organizationSlug,
                  input.organizationSlug,
                ),
                sql`lower(${pendingOrganizationSignups.email}) = ${normalizedEmail}`,
              ),
            ),
          );

        await transaction.insert(pendingOrganizationSignups).values({
          id: pendingId,
          organizationName: input.organizationName,
          organizationSlug: input.organizationSlug,
          email: normalizedEmail,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          tokenHash: hashToken(token),
          expiresAt,
        });
      });
    } catch (error) {
      if (isSignupConflict(error)) {
        throw new AppError(
          409,
          "SIGNUP_ALREADY_EXISTS",
          "A workspace slug or pending signup with this email already exists",
        );
      }
      throw error;
    }

    try {
      await deliverVerificationEmail({
        organizationId: pendingId,
        to: normalizedEmail,
        verificationUrl: getVerificationUrl(token),
        expiresAt,
      });
    } catch (error) {
      try {
        await db
          .delete(pendingOrganizationSignups)
          .where(eq(pendingOrganizationSignups.id, pendingId));
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Email delivery and pending signup cleanup both failed",
        );
      }
      throw error;
    }
  },

  async resendVerification(
    input: ResendOrganizationSignupVerificationInput,
  ): Promise<void> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VERIFICATION_LIFETIME_MS);

    try {
      await db.transaction(async (transaction) => {
        const [existing] = await transaction
          .select()
          .from(pendingOrganizationSignups)
          .where(
            and(
              eq(
                pendingOrganizationSignups.organizationSlug,
                input.organizationSlug,
              ),
              sql`lower(${pendingOrganizationSignups.email}) = ${normalizedEmail}`,
            ),
          )
          .limit(1)
          .for("update");

        if (!existing || existing.expiresAt.getTime() <= now.getTime()) {
          return;
        }

        const [updated] = await transaction
          .update(pendingOrganizationSignups)
          .set({ tokenHash, expiresAt })
          .where(eq(pendingOrganizationSignups.id, existing.id))
          .returning({
            email: pendingOrganizationSignups.email,
          });

        if (!updated) {
          return;
        }

        try {
          await deliverVerificationEmail({
            organizationId: existing.id,
            to: updated.email,
            verificationUrl: getVerificationUrl(token),
            expiresAt,
          });
        } catch {
          throw new VerificationEmailDeliveryError();
        }
      });
    } catch (error) {
      if (!(error instanceof VerificationEmailDeliveryError)) {
        throw error;
      }

      logger.error(
        { event: "organization_signup_verification_delivery_failed" },
        "Signup verification email delivery failed",
      );
    }
  },

  async verify(token: string) {
    const tokenHash = hashToken(token);

    return db.transaction(async (transaction) => {
      const [pending] = await transaction
        .select()
        .from(pendingOrganizationSignups)
        .where(eq(pendingOrganizationSignups.tokenHash, tokenHash))
        .limit(1)
        .for("update");

      if (!pending) {
        throw new AppError(
          410,
          "VERIFICATION_TOKEN_INVALID",
          "This verification link is invalid, expired, or already used",
        );
      }

      if (pending.expiresAt.getTime() <= Date.now()) {
        throw new AppError(
          410,
          "VERIFICATION_TOKEN_EXPIRED",
          "This verification link has expired",
        );
      }

      const [organization] = await transaction
        .insert(organizations)
        .values({
          name: pending.organizationName,
          slug: pending.organizationSlug,
        })
        .returning({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          createdAt: organizations.createdAt,
        });

      if (!organization) {
        throw new AppError(
          500,
          "ORGANIZATION_CREATION_FAILED",
          "Failed to create organization",
        );
      }

      const [admin] = await transaction
        .insert(users)
        .values({
          organizationId: organization.id,
          email: pending.email,
          passwordHash: pending.passwordHash,
          firstName: pending.firstName,
          lastName: pending.lastName,
          role: "admin",
          isActive: true,
        })
        .returning({
          id: users.id,
          organizationId: users.organizationId,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
        });

      if (!admin) {
        throw new AppError(
          500,
          "ADMIN_CREATION_FAILED",
          "Failed to create first organization administrator",
        );
      }

      await transaction
        .delete(pendingOrganizationSignups)
        .where(eq(pendingOrganizationSignups.id, pending.id));

      return { organization, admin };
    }).catch((error: unknown) => {
      if (isSignupConflict(error)) {
        throw new AppError(
          409,
          "SIGNUP_ALREADY_EXISTS",
          "The workspace slug or administrator membership already exists",
        );
      }
      throw error;
    });
  },
};
