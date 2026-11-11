import type { TicketPriority } from "../types/sla.types.js";
import type { SlaDeadlines } from "../types/sla.types.js";

export const defaultSlaWindows: Record<
  TicketPriority,
  { firstResponseMinutes: number; resolutionMinutes: number }
> = {
  low: { firstResponseMinutes: 1440, resolutionMinutes: 4320 },
  medium: { firstResponseMinutes: 480, resolutionMinutes: 1440 },
  high: { firstResponseMinutes: 120, resolutionMinutes: 480 },
  urgent: { firstResponseMinutes: 30, resolutionMinutes: 120 },
};

export const calculateSlaDeadlines = (
  createdAt: Date,
  priority: TicketPriority,
  policy?: {
    firstResponseMinutes: number;
    resolutionMinutes: number;
  } | null,
): SlaDeadlines => {
  const window = policy ?? defaultSlaWindows[priority];
  return {
    firstResponseDeadlineAt: new Date(
      createdAt.getTime() + window.firstResponseMinutes * 60_000,
    ),
    resolutionDeadlineAt: new Date(
      createdAt.getTime() + window.resolutionMinutes * 60_000,
    ),
  };
};
