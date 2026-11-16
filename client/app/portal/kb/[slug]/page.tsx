import { PortalKbArticle } from "@/components/portal/portal-kb-article";

export default async function PortalKnowledgeBaseArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PortalKbArticle slug={slug} />;
}

