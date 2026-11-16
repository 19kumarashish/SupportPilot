"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listKbArticles, type KbArticle, type KbStatus, type KbVisibility } from "@/lib/kb-api";

export function KbArticleList() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [status, setStatus] = useState<"all" | KbStatus>("all");
  const [visibility, setVisibility] = useState<"all" | KbVisibility>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (visibility !== "all") params.set("visibility", visibility);
    listKbArticles(params.toString() ? `?${params.toString()}` : "")
      .then(({ data }) => setArticles(data.items))
      .catch(() => setError("Could not load knowledge base articles."));
  }, [status, visibility]);

  return (
    <section className="management-panel">
      <div className="management-panel-heading"><div><h1>Knowledge base</h1><p>Manage tenant-scoped support content.</p></div><Link className="primary-button" href="/kb/articles/new">New article</Link></div>
      <div className="management-form-grid">
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as "all" | KbStatus)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
        <select aria-label="Filter by visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as "all" | KbVisibility)}><option value="all">All visibility</option><option value="public">Public</option><option value="customers_only">Customers only</option><option value="internal_staff">Internal staff</option></select>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="ticket-list">{articles.map((article) => <Link className="ticket-row" href={`/kb/articles/${article.id}`} key={article.id}><strong>{article.title}</strong><span>{article.status} · {article.visibility}</span></Link>)}</div>
      {!articles.length && !error && <p className="empty-state">No articles match these filters.</p>}
    </section>
  );
}

