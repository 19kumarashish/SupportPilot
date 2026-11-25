export interface EmbeddingProvider {
  embedTexts(texts: string[]): Promise<number[][]>;
}

export interface ChunkContext {
  heading: string | null;
  content: string;
  articleId: string;
  slug: string;
  title: string;
  score: number;
}

export interface GroundedReplyInput {
  systemPrompt: string;
  userMessage: string;
  chunks: ChunkContext[];
}

export interface Citation {
  articleId: string;
  slug: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface GroundedReplyOutput {
  answer: string;
  confidence: number;
  promptTokens: number;
  completionTokens: number;
  citations: Citation[];
}

export interface ChatCompletionProvider {
  generateGroundedReply(input: GroundedReplyInput): Promise<GroundedReplyOutput>;
}
