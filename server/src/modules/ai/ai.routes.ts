import { Router } from "express";
import type { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { enqueueKbReindex } from "../../workers/jobs.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { aiService } from "./ai.service.js";
import { draftReplyParamSchema, reindexParamSchema } from "./ai.validators.js";

export const aiRouter: Router = Router();
aiRouter.use(requireAuth);

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid request data");
  }
  return result.data;
};

aiRouter.post(
  "/tickets/:ticketId/draft-reply",
  requireRole("admin", "agent"),
  async (request, response) => {
    const { organizationId, userId } = getTenantContext(request);
    const { ticketId } = parse(draftReplyParamSchema, request.params);
    const result = await aiService.draftReply(organizationId, ticketId, userId);
    response.json({ success: true, data: result });
  },
);

aiRouter.post(
  "/reindex/:articleId",
  requireRole("admin"),
  async (request, response) => {
    const { organizationId } = getTenantContext(request);
    const { articleId } = parse(reindexParamSchema, request.params);
    await enqueueKbReindex(organizationId, articleId);
    response.status(202).json({ success: true, data: { queued: true } });
  },
);
