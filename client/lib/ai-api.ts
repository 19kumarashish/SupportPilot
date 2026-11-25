import { apiJson } from "@/lib/api";

export interface AiCitation {
  articleId: string;
  slug: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface DraftReplyResult {
  draft: string;
  citations: AiCitation[];
  confidence: number;
}

export const draftTicketReply = (ticketId: string) =>
  apiJson<{ success: true; data: DraftReplyResult }>(
    `/ai/tickets/${ticketId}/draft-reply`,
    { method: "POST" },
  );
