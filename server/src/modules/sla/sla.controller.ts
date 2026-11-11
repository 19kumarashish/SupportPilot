import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { slaService } from "./services/sla.service.js";
import {
  createSlaPolicySchema,
  slaPolicyIdParamsSchema,
  updateSlaPolicySchema,
} from "./validators/sla.validators.js";

const invalid = (): AppError =>
  new AppError(400, "VALIDATION_ERROR", "Invalid SLA policy data");

export const listSlaPolicies: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  response.json({
    success: true,
    data: { policies: await slaService.list(organizationId) },
  });
};

export const createSlaPolicy: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsed = createSlaPolicySchema.safeParse(request.body);
  if (!parsed.success) throw invalid();
  response.status(201).json({
    success: true,
    data: { policy: await slaService.create(organizationId, parsed.data) },
  });
};

export const updateSlaPolicy: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const params = slaPolicyIdParamsSchema.safeParse(request.params);
  const body = updateSlaPolicySchema.safeParse(request.body);
  if (!params.success || !body.success) throw invalid();
  response.json({
    success: true,
    data: {
      policy: await slaService.update(organizationId, params.data.id, body.data),
    },
  });
};

export const deleteSlaPolicy: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const params = slaPolicyIdParamsSchema.safeParse(request.params);
  if (!params.success) throw invalid();
  await slaService.delete(organizationId, params.data.id);
  response.status(204).send();
};
