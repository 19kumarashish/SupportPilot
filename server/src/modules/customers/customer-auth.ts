import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../../shared/errors/app-error.js";
import {
  generateCustomerAccessToken,
  verifyCustomerAccessToken,
} from "../../shared/security/jwt.js";
import { verifyPassword } from "../../shared/security/password.js";
import { organizationRepository } from "../organizations/repositories/organization.repository.js";
import * as customerRepository from "./repositories/customer.repository.js";

const customerLoginSchema = z.object({
  organizationSlug: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();

export const customerLogin: RequestHandler = async (request, response) => {
  const parsed = customerLoginSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid customer login");
  const organizationId = await organizationRepository.findIdBySlug(parsed.data.organizationSlug);
  if (!organizationId) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  const customer = await customerRepository.findPortalByEmail(organizationId, parsed.data.email);
  if (!customer || !customer.portalEnabled || !customer.isActive || !customer.portalPasswordHash) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  const valid = await verifyPassword(parsed.data.password, customer.portalPasswordHash);
  if (!valid) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  const accessToken = await generateCustomerAccessToken({
    customerId: customer.id,
    organizationId,
    type: "customer_access",
  });
  response.json({ success: true, data: { accessToken, customerId: customer.id } });
};

export interface CustomerAccessRequest extends Request {
  customer?: { id: string; organizationId: string };
}

export const requireCustomerAuth: RequestHandler = async (request, _response, next) => {
  try {
    const [scheme, token] = String(request.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
    const payload = await verifyCustomerAccessToken(token);
    if (payload.type !== "customer_access") throw new AppError(401, "INVALID_ACCESS_TOKEN", "Invalid customer access token");
    const customer = await customerRepository.findByIdInOrganization(payload.organizationId, payload.customerId);
    if (!customer) throw new AppError(401, "CUSTOMER_NOT_FOUND", "Customer session is invalid");
    (request as CustomerAccessRequest).customer = { id: customer.id, organizationId: payload.organizationId };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, "INVALID_ACCESS_TOKEN", "Invalid or expired customer access token"));
  }
};
