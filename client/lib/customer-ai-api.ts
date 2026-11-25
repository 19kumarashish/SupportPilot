import { customerApiJson } from "@/lib/customer-auth";
import type { AiCitation } from "@/lib/ai-api";

export interface CustomerAskResult {
  answer?: string;
  citations?: AiCitation[];
  confidence?: number;
  handedOff: boolean;
  message?: string;
}

export const askCustomerAi = (question: string) =>
  customerApiJson<{ success: true; data: CustomerAskResult }>("/customer/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
