import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../../infrastructure/database/index.js";
import { ticketCategories } from "../../db/schema/ticket-categories.js";
import { ticketTags } from "../../db/schema/ticket-tags.js";
import { ticketTagLinks } from "../../db/schema/ticket-tag-links.js";
import { tickets } from "../../db/schema/tickets.js";

export const ticketManagementRepository = {
  async listCategories(organizationId: string) {
    return db.select().from(ticketCategories).where(and(
      eq(ticketCategories.organizationId, organizationId),
      isNull(ticketCategories.deletedAt),
    )).orderBy(asc(ticketCategories.name));
  },
  async createCategory(
    organizationId: string,
    input: { name: string; slug: string; description?: string | null | undefined; isActive?: boolean | undefined },
  ) {
    const [item] = await db.insert(ticketCategories).values({ ...input, organizationId }).returning();
    return item ?? null;
  },
  async updateCategory(
    organizationId: string,
    id: string,
    input: { name?: string | undefined; slug?: string | undefined; description?: string | null | undefined; isActive?: boolean | undefined },
  ) {
    const [item] = await db.update(ticketCategories).set({ ...input, updatedAt: new Date() }).where(and(
      eq(ticketCategories.organizationId, organizationId),
      eq(ticketCategories.id, id),
      isNull(ticketCategories.deletedAt),
    )).returning();
    return item ?? null;
  },
  async deleteCategory(organizationId: string, id: string) {
    const [item] = await db.update(ticketCategories).set({ deletedAt: new Date(), isActive: false }).where(and(
      eq(ticketCategories.organizationId, organizationId),
      eq(ticketCategories.id, id),
      isNull(ticketCategories.deletedAt),
    )).returning();
    return item ?? null;
  },
  async listTags(organizationId: string) {
    return db.select().from(ticketTags).where(and(
      eq(ticketTags.organizationId, organizationId),
      isNull(ticketTags.deletedAt),
    )).orderBy(asc(ticketTags.name));
  },
  async createTag(
    organizationId: string,
    input: { name: string; slug: string; color?: string | null | undefined },
  ) {
    const [item] = await db.insert(ticketTags).values({ ...input, organizationId }).returning();
    return item ?? null;
  },
  async updateTag(
    organizationId: string,
    id: string,
    input: { name?: string | undefined; slug?: string | undefined; color?: string | null | undefined },
  ) {
    const [item] = await db.update(ticketTags).set({ ...input, updatedAt: new Date() }).where(and(
      eq(ticketTags.organizationId, organizationId),
      eq(ticketTags.id, id),
      isNull(ticketTags.deletedAt),
    )).returning();
    return item ?? null;
  },
  async deleteTag(organizationId: string, id: string) {
    return db.transaction(async (transaction) => {
      const [item] = await transaction.update(ticketTags).set({ deletedAt: new Date() }).where(and(
        eq(ticketTags.organizationId, organizationId),
        eq(ticketTags.id, id),
        isNull(ticketTags.deletedAt),
      )).returning();
      if (!item) return null;
      await transaction.delete(ticketTagLinks).where(eq(ticketTagLinks.tagId, id));
      return item;
    });
  },
  async replaceTicketTags(organizationId: string, ticketId: string, tagIds: string[]) {
    return db.transaction(async (transaction) => {
      const [ticket] = await transaction.select({ id: tickets.id }).from(tickets).where(and(
        eq(tickets.id, ticketId), eq(tickets.organizationId, organizationId),
      ));
      if (!ticket) return null;
      if (tagIds.length) {
        const validTags = await transaction.select({ id: ticketTags.id }).from(ticketTags).where(and(
          eq(ticketTags.organizationId, organizationId),
          isNull(ticketTags.deletedAt),
        ));
        const allowed = new Set(validTags.map((tag) => tag.id));
        const unique = [...new Set(tagIds)].filter((id) => allowed.has(id));
        if (unique.length !== [...new Set(tagIds)].length) return null;
      }
      await transaction.delete(ticketTagLinks).where(eq(ticketTagLinks.ticketId, ticketId));
      if (tagIds.length) {
        await transaction.insert(ticketTagLinks).values(
          [...new Set(tagIds)].map((tagId) => ({ ticketId, tagId })),
        );
      }
      return ticket;
    });
  },
};
