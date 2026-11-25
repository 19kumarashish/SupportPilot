import { env } from "../../config/env.js";
import type { ChatCompletionProvider, EmbeddingProvider } from "./ai-provider.types.js";
import { MockChatCompletionProvider, MockEmbeddingProvider } from "./mock-ai-provider.js";
import { OpenAiChatCompletionProvider, OpenAiEmbeddingProvider } from "./openai-ai-provider.js";

function createProviders(): { embedding: EmbeddingProvider; chat: ChatCompletionProvider } {
  if (env.AI_PROVIDER === "openai") {
    const apiKey = env.AI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_API_KEY is required when AI_PROVIDER=openai");
    }
    return {
      embedding: new OpenAiEmbeddingProvider(env.AI_BASE_URL, apiKey, env.AI_EMBEDDING_MODEL),
      chat: new OpenAiChatCompletionProvider(env.AI_BASE_URL, apiKey, env.AI_CHAT_MODEL),
    };
  }
  // Default: mock (development / test)
  return {
    embedding: new MockEmbeddingProvider(),
    chat: new MockChatCompletionProvider(),
  };
}

const providers = createProviders();

export const embeddingProvider: EmbeddingProvider = providers.embedding;
export const chatProvider: ChatCompletionProvider = providers.chat;
export type { EmbeddingProvider, ChatCompletionProvider, GroundedReplyInput, GroundedReplyOutput, Citation, ChunkContext } from "./ai-provider.types.js";
