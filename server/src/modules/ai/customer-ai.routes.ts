import { Router } from "express";
import type { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { requireCustomerAuth, type CustomerAccessRequest } from "../customers/customer-auth.js";
import { aiService } from "./ai.service.js";
import { customerAskSchema } from "./ai.validators.js";

export const customerAiRouter: Router = Router();
customerAiRouter.use(requireCustomerAuth);

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid request data");
  }
  return result.data;
};

customerAiRouter.post("/ask", async (request, response) => {
  const customer = (request as CustomerAccessRequest).customer;
  if (!customer) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }

  const { question } = parse(customerAskSchema, request.body);
  const result = await aiService.customerAsk(
    customer.organizationId,
    customer.id,
    question,
  );

  response.json({ success: true, data: result });
});
