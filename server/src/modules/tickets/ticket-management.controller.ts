import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { categorySchema, relationSchema, tagSchema } from "./ticket-management.validators.js";
import { ticketManagementRepository } from "./ticket-management.repository.js";
import { ticketRepository } from "./repositories/ticket.repository.js";

const validationError = (): AppError => new AppError(400, "VALIDATION_ERROR", "Invalid ticket management data");

const idSchema = z.object({ id: z.uuid() }).strict();

export const listCategories: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  response.json({ success: true, data: { categories: await ticketManagementRepository.listCategories(organizationId) } });
};
export const createCategory: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsed = categorySchema.safeParse(request.body);
  if (!parsed.success) throw validationError();
  response.status(201).json({ success: true, data: { category: await ticketManagementRepository.createCategory(organizationId, parsed.data) } });
};
export const updateCategory: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = idSchema.safeParse(request.params);
  const body = categorySchema.partial().safeParse(request.body);
  if (!params.success || !body.success) throw validationError();
  const item = await ticketManagementRepository.updateCategory(tenant.organizationId, params.data.id, body.data);
  if (!item) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  response.json({ success: true, data: { category: item } });
};
export const deleteCategory: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = idSchema.safeParse(request.params);
  if (!params.success) throw validationError();
  const item = await ticketManagementRepository.deleteCategory(tenant.organizationId, params.data.id);
  if (!item) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  response.json({ success: true, data: { category: item } });
};
export const listTags: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  response.json({ success: true, data: { tags: await ticketManagementRepository.listTags(organizationId) } });
};
export const createTag: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsed = tagSchema.safeParse(request.body);
  if (!parsed.success) throw validationError();
  response.status(201).json({ success: true, data: { tag: await ticketManagementRepository.createTag(organizationId, parsed.data) } });
};
export const updateTag: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = idSchema.safeParse(request.params);
  const body = tagSchema.partial().safeParse(request.body);
  if (!params.success || !body.success) throw validationError();
  const item = await ticketManagementRepository.updateTag(tenant.organizationId, params.data.id, body.data);
  if (!item) throw new AppError(404, "TAG_NOT_FOUND", "Tag not found");
  response.json({ success: true, data: { tag: item } });
};
export const deleteTag: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = idSchema.safeParse(request.params);
  if (!params.success) throw validationError();
  const item = await ticketManagementRepository.deleteTag(tenant.organizationId, params.data.id);
  if (!item) throw new AppError(404, "TAG_NOT_FOUND", "Tag not found");
  response.json({ success: true, data: { tag: item } });
};
export const replaceTicketTags: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = idSchema.safeParse(request.params);
  const body = z.object({ tagIds: z.array(z.uuid()).max(20) }).strict().safeParse(request.body);
  if (!params.success || !body.success) throw validationError();
  const result = await ticketManagementRepository.replaceTicketTags(tenant.organizationId, params.data.id, body.data.tagIds);
  if (!result) throw new AppError(404, "TICKET_OR_TAG_NOT_FOUND", "Ticket or one of the tags was not found in this organization");
  response.json({ success: true, data: { ticketId: params.data.id } });
};
export const addTicketRelation: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = idSchema.safeParse(request.params);
  const body = relationSchema.safeParse(request.body);
  if (!params.success || !body.success) throw validationError();
  const relation = await ticketRepository.addRelationInOrganization(tenant.organizationId, params.data.id, body.data.relatedTicketId, body.data.relationType);
  if (!relation) throw new AppError(404, "TICKET_RELATION_NOT_FOUND", "One or both tickets were not found in this organization");
  response.status(201).json({ success: true, data: { relation } });
};
