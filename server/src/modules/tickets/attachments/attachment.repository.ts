import { and, asc, count, eq, lt } from "drizzle-orm";

import { ticketAttachments } from "../../../db/schema/ticket-attachments.js";
import { tickets } from "../../../db/schema/tickets.js";
import { db } from "../../../infrastructure/database/index.js";
import type { ListTicketAttachmentsQuery } from "./attachment.validators.js";

const attachmentSelect = {
  id: ticketAttachments.id,
  ticketId: ticketAttachments.ticketId,
  uploaderId: ticketAttachments.uploaderId,
  customerUploaderId: ticketAttachments.customerUploaderId,
  originalFilename: ticketAttachments.originalFilename,
  contentType: ticketAttachments.contentType,
  sizeBytes: ticketAttachments.sizeBytes,
  storageKey: ticketAttachments.storageKey,
  storageDriver: ticketAttachments.storageDriver,
  scanStatus: ticketAttachments.scanStatus,
  scannedAt: ticketAttachments.scannedAt,
  checksumSha256: ticketAttachments.checksumSha256,
  createdAt: ticketAttachments.createdAt,
};

export const ticketAttachmentRepository = {
  async create(input: typeof ticketAttachments.$inferInsert) {
    const [attachment] = await db
      .insert(ticketAttachments)
      .values(input)
      .returning(attachmentSelect);

    return attachment ?? null;
  },

  async listInOrganization(
    organizationId: string,
    ticketId: string,
    query: ListTicketAttachmentsQuery,
  ) {
    const conditions = and(
      eq(ticketAttachments.ticketId, ticketId),
      eq(tickets.organizationId, organizationId),
    );
    const offset = (query.page - 1) * query.limit;
    const [items, totalResult] = await Promise.all([
      db
        .select(attachmentSelect)
        .from(ticketAttachments)
        .innerJoin(tickets, eq(ticketAttachments.ticketId, tickets.id))
        .where(conditions)
        .orderBy(asc(ticketAttachments.createdAt), asc(ticketAttachments.id))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(ticketAttachments)
        .innerJoin(tickets, eq(ticketAttachments.ticketId, tickets.id))
        .where(conditions),
    ]);

    return { items, total: Number(totalResult[0]?.count ?? 0) };
  },

  async findByIdInOrganization(
    organizationId: string,
    ticketId: string,
    attachmentId: string,
  ) {
    const [attachment] = await db
      .select(attachmentSelect)
      .from(ticketAttachments)
      .innerJoin(tickets, eq(ticketAttachments.ticketId, tickets.id))
      .where(
        and(
          eq(ticketAttachments.ticketId, ticketId),
          eq(ticketAttachments.id, attachmentId),
          eq(tickets.organizationId, organizationId),
        ),
      )
      .limit(1);

    return attachment ?? null;
  },

  async delete(attachmentId: string, ticketId: string) {
    const [attachment] = await db
      .delete(ticketAttachments)
      .where(
        and(
          eq(ticketAttachments.id, attachmentId),
          eq(ticketAttachments.ticketId, ticketId),
        ),
      )
      .returning(attachmentSelect);

    return attachment ?? null;
  },

  async restore(input: typeof ticketAttachments.$inferInsert) {
    const [attachment] = await db
      .insert(ticketAttachments)
      .values(input)
      .returning(attachmentSelect);

    return attachment ?? null;
  },

  async markScanResult(
    organizationId: string,
    ticketId: string,
    attachmentId: string,
    scanStatus: "clean" | "infected",
    scannedAt: Date,
  ) {
    const [attachment] = await db
      .update(ticketAttachments)
      .set({ scanStatus, scannedAt })
      .where(and(
        eq(ticketAttachments.id, attachmentId),
        eq(ticketAttachments.ticketId, ticketId),
        eq(tickets.organizationId, organizationId),
      ))
      .from(tickets)
      .returning(attachmentSelect);
    return attachment ?? null;
  },

  async listStorageKeys() {
    return db.select({
      storageKey: ticketAttachments.storageKey,
      createdAt: ticketAttachments.createdAt,
    }).from(ticketAttachments);
  },

  async listStalePending(cutoff: Date) {
    return db.select({
      id: ticketAttachments.id,
      ticketId: ticketAttachments.ticketId,
      storageKey: ticketAttachments.storageKey,
    })
      .from(ticketAttachments)
      .where(and(
        eq(ticketAttachments.scanStatus, "pending"),
        lt(ticketAttachments.createdAt, cutoff),
      ));
  },

  async deleteById(id: string) {
    await db.delete(ticketAttachments).where(eq(ticketAttachments.id, id));
  },
};
