import { AppError } from "../../../shared/errors/app-error.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../infrastructure/logger/index.js";
import { slaRepository } from "../repositories/sla.repository.js";
import { calculateSlaDeadlines } from "./sla-calculator.js";
import type { TicketPriority } from "../types/sla.types.js";
import type {
  CreateSlaPolicyInput,
  UpdateSlaPolicyInput,
} from "../validators/sla.validators.js";

const notFound = (): AppError =>
  new AppError(404, "SLA_POLICY_NOT_FOUND", "SLA policy not found");

export const slaService = {
  list(organizationId: string) {
    return slaRepository.listInOrganization(organizationId);
  },

  async create(organizationId: string, input: CreateSlaPolicyInput) {
    const existing = await slaRepository.findByPriority(
      organizationId,
      input.priority,
    );
    if (existing) {
      throw new AppError(
        409,
        "SLA_POLICY_ALREADY_EXISTS",
        "An SLA policy already exists for this priority",
      );
    }
    return slaRepository.create(organizationId, input);
  },

  async update(
    organizationId: string,
    id: string,
    input: UpdateSlaPolicyInput,
  ) {
    const existing = await slaRepository.findByIdInOrganization(
      organizationId,
      id,
    );
    if (!existing) throw notFound();
    if (input.priority && input.priority !== existing.priority) {
      const duplicate = await slaRepository.findByPriority(
        organizationId,
        input.priority,
      );
      if (duplicate) {
        throw new AppError(
          409,
          "SLA_POLICY_ALREADY_EXISTS",
          "An SLA policy already exists for this priority",
        );
      }
    }
    return slaRepository.update(organizationId, id, input);
  },

  async delete(organizationId: string, id: string) {
    const deleted = await slaRepository.delete(organizationId, id);
    if (!deleted) throw notFound();
    return deleted;
  },

  async resolve(organizationId: string, priority: TicketPriority) {
    return slaRepository.findByPriority(organizationId, priority);
  },

  async calculateDeadlines(
    organizationId: string,
    priority: TicketPriority,
    createdAt: Date,
  ) {
    let policy = null;
    try {
      policy = await slaRepository.findByPriority(organizationId, priority);
    } catch (error) {
      let current: unknown = error;
      let code: unknown;
      const visited = new Set<unknown>();
      while (
        typeof current === "object" &&
        current !== null &&
        !visited.has(current)
      ) {
        visited.add(current);
        if ("code" in current && typeof current.code === "string") {
          code = current.code;
          break;
        }
        current = "cause" in current ? current.cause : undefined;
      }
      if (env.NODE_ENV === "production") {
        throw error;
      }
      logger.warn({ code, organizationId }, "Using default SLA policy in local environment");
    }
    return calculateSlaDeadlines(createdAt, priority, policy);
  },
};
