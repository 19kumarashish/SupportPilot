import { AppError } from "../../shared/errors/app-error.js";
import type {
  ChatCompletionProvider,
  Citation,
  EmbeddingProvider,
  GroundedReplyInput,
  GroundedReplyOutput,
} from "./ai-provider.types.js";

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

interface OpenAiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAiChatResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// Expected JSON structure in the LLM's response content
interface LlmJsonOutput {
  answer: string;
  confidence: number;
  citations: Array<{ articleId: string; excerpt: string }>;
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async embedTexts(texts: string[]): Promise<number[][]> {
    // Batch max 100 texts per OpenAI call
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: batch }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new AppError(502, "AI_PROVIDER_ERROR", `Embedding API error ${response.status}: ${text.slice(0, 200)}`);
      }
      const data = (await response.json()) as OpenAiEmbeddingResponse;
      // Sort by index to preserve order
      const sorted = [...data.data].sort((a, b) => a.index - b.index);
      results.push(...sorted.map((d) => d.embedding));
    }
    return results;
  }
}

export class OpenAiChatCompletionProvider implements ChatCompletionProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateGroundedReply(input: GroundedReplyInput): Promise<GroundedReplyOutput> {
    // Build a context block from the chunks
    const contextText = input.chunks
      .map((c, i) => {
        const heading = c.heading ? `## ${c.heading}\n` : "";
        return `[Source ${i + 1}: articleId=${c.articleId} slug=${c.slug} title="${c.title}" score=${c.score.toFixed(3)}]\n${heading}${c.content}`;
      })
      .join("\n\n---\n\n");

    const systemContent = `${input.systemPrompt}

You are a support assistant. Answer the user's question using ONLY the provided knowledge base sources below.
Respond with valid JSON in this exact format:
{"answer": "<your answer>", "confidence": <0.0-1.0>, "citations": [{"articleId": "<id>", "excerpt": "<relevant quote max 200 chars>"}]}

If the sources do not contain enough information, set confidence below 0.65 and explain what you don't know.
Never invent information not present in the sources.

KNOWLEDGE BASE SOURCES:
${contextText}`;

    const messages: OpenAiChatMessage[] = [
      { role: "system", content: systemContent },
      { role: "user", content: input.userMessage },
    ];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new AppError(502, "AI_PROVIDER_ERROR", `Chat API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as OpenAiChatResponse;
    const content = data.choices[0]?.message.content ?? "{}";
    const promptTokens = data.usage.prompt_tokens;
    const completionTokens = data.usage.completion_tokens;

    let parsed: LlmJsonOutput;
    try {
      parsed = JSON.parse(content) as LlmJsonOutput;
      if (typeof parsed.answer !== "string" || typeof parsed.confidence !== "number") {
        throw new Error("Invalid shape");
      }
    } catch {
      // Fallback: return raw content with zero confidence so the caller can hand off
      return {
        answer: content,
        confidence: 0,
        promptTokens,
        completionTokens,
        citations: [],
      };
    }

    // Map citation articleIds back to full chunk metadata
    const citations: Citation[] = (parsed.citations ?? []).flatMap((c) => {
      const chunk = input.chunks.find((ch) => ch.articleId === c.articleId);
      if (!chunk) return [];
      return [{
        articleId: chunk.articleId,
        slug: chunk.slug,
        title: chunk.title,
        excerpt: c.excerpt ?? chunk.content.slice(0, 200),
        score: chunk.score,
      }];
    });

    return {
      answer: parsed.answer,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      promptTokens,
      completionTokens,
      citations,
    };
  }
}
