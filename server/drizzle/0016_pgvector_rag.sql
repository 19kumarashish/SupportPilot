CREATE EXTENSION IF NOT EXISTS vector;
-->statement-breakpoint
CREATE TYPE "public"."ai_actor_type" AS ENUM('staff', 'customer');
-->statement-breakpoint
CREATE TYPE "public"."ai_feature" AS ENUM('agent_draft', 'customer_qa', 'reindex');
-->statement-breakpoint
CREATE TABLE "kb_article_chunks" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "article_id"      uuid NOT NULL REFERENCES "kb_articles"("id") ON DELETE CASCADE,
  "version_number"  integer NOT NULL,
  "visibility"      "kb_article_visibility" NOT NULL,
  "chunk_index"     integer NOT NULL,
  "heading"         text,
  "content"         text NOT NULL,
  "token_count"     integer NOT NULL,
  "embedding"       vector(1536),
  "created_at"      timestamptz NOT NULL DEFAULT now()
);
-->statement-breakpoint
CREATE INDEX "kb_article_chunks_embedding_hnsw_idx" ON "kb_article_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-->statement-breakpoint
CREATE INDEX "kb_article_chunks_org_idx" ON "kb_article_chunks"("organization_id");
-->statement-breakpoint
CREATE UNIQUE INDEX "kb_article_chunks_article_chunk_unique" ON "kb_article_chunks"("article_id", "chunk_index");
-->statement-breakpoint
CREATE TABLE "ai_usage_logs" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"   uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "actor_type"        "ai_actor_type" NOT NULL,
  "actor_id"          uuid,
  "ticket_id"         uuid REFERENCES "tickets"("id") ON DELETE SET NULL,
  "feature"           "ai_feature" NOT NULL,
  "model"             varchar(100) NOT NULL,
  "prompt_tokens"     integer NOT NULL DEFAULT 0,
  "completion_tokens" integer NOT NULL DEFAULT 0,
  "confidence_score"  numeric(5,4),
  "handed_off"        boolean NOT NULL DEFAULT false,
  "created_at"        timestamptz NOT NULL DEFAULT now()
);
-->statement-breakpoint
CREATE INDEX "ai_usage_logs_org_created_idx" ON "ai_usage_logs"("organization_id", "created_at");
-->statement-breakpoint
CREATE INDEX "ai_usage_logs_org_feature_created_idx" ON "ai_usage_logs"("organization_id", "feature", "created_at");
