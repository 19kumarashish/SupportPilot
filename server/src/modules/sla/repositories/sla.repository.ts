import { and, eq, ne } from "drizzle-orm";

import { slaPolicies } from "../../../db/schema/sla-policies.js";
import { db } from "../../../infrastructure/database/index.js";
import type {
  CreateSlaPolicyInput,
  UpdateSlaPolicyInput,
} from "../validators/sla.validators.js";
import type { TicketPriority } from "../types/sla.types.js";

export const slaRepository = {
  async listInOrganization(organizationId: string) {
    return db.select().from(slaPolicies).where(
      eq(slaPolicies.organizationId, organizationId),
    );
  },

  async findByPriority(organizationId: string, priority: TicketPriority) {
    const [policy] = await db.select().from(slaPolicies).where(and(
      eq(slaPolicies.organizationId, organizationId),
      eq(slaPolicies.priority, priority),
    )).limit(1);
    return policy ?? null;
  },

  async findByIdInOrganization(organizationId: string, id: string) {
    const [policy] = await db.select().from(slaPolicies).where(and(
      eq(slaPolicies.organizationId, organizationId),
      eq(slaPolicies.id, id),
    )).limit(1);
    return policy ?? null;
  },

  async create(organizationId: string, input: CreateSlaPolicyInput) {
    return db.transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.update(slaPolicies)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(slaPolicies.organizationId, organizationId));
      }
      const [policy] = await transaction.insert(slaPolicies).values({
        organizationId,
        ...input,
      }).returning();
      return policy ?? null;
    });
  },

  async update(
    organizationId: string,
    id: string,
    input: UpdateSlaPolicyInput,
  ) {
    return db.transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.update(slaPolicies)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(
            eq(slaPolicies.organizationId, organizationId),
            ne(slaPolicies.id, id),
          ));
      }
      const [policy] = await transaction.update(slaPolicies)
        .set({ ...input, updatedAt: new Date() })
        .where(and(
          eq(slaPolicies.organizationId, organizationId),
          eq(slaPolicies.id, id),
        ))
        .returning();
      return policy ?? null;
    });
  },

  async delete(organizationId: string, id: string) {
    const [policy] = await db.delete(slaPolicies).where(and(
      eq(slaPolicies.organizationId, organizationId),
      eq(slaPolicies.id, id),
    )).returning({ id: slaPolicies.id });
    return policy ?? null;
  },
};
