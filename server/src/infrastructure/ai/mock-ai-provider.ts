import { createHash } from "node:crypto";
import type {
  ChatCompletionProvider,
  Citation,
  EmbeddingProvider,
  GroundedReplyInput,
  GroundedReplyOutput,
} from "./ai-provider.types.js";

// Deterministic: same text → same 1536-float pseudovector (via sha256 bytes)
const textToVector = (text: string): number[] => {
  const hash = createHash("sha256").update(text).digest();
  const result: number[] = [];
  while (result.length < 1536) {
    for (const byte of hash) {
      if (result.length >= 1536) break;
      result.push((byte / 255) * 2 - 1); // normalize to [-1, 1]
    }
  }
  return result;
};

export class MockEmbeddingProvider implements EmbeddingProvider {
  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map(textToVector);
  }
}

export class MockChatCompletionProvider implements ChatCompletionProvider {
  async generateGroundedReply(input: GroundedReplyInput): Promise<GroundedReplyOutput> {
    const topChunk = input.chunks[0];
    const citations: Citation[] = topChunk
      ? [{
          articleId: topChunk.articleId,
          slug: topChunk.slug,
          title: topChunk.title,
          excerpt: topChunk.content.slice(0, 200),
          score: topChunk.score,
        }]
      : [];

    const answer = topChunk
      ? `Based on our knowledge base: ${topChunk.content.slice(0, 300)}`
      : "I could not find relevant information to answer your question.";

    return {
      answer,
      confidence: topChunk ? 0.9 : 0.1,
      promptTokens: Math.ceil(input.userMessage.length / 4),
      completionTokens: Math.ceil(answer.length / 4),
      citations,
    };
  }
}
