import { AppShell } from "@/components/app-shell";
import { KbArticleEditor } from "@/components/kb/kb-article-editor";

export default async function KnowledgeBaseArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><KbArticleEditor articleId={id} /></AppShell>;
}

