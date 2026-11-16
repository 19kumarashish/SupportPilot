"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listCustomerKb, searchCustomerKb } from "@/lib/customer-kb-api";
import type { KbArticle } from "@/lib/kb-api";

export function PortalKbBrowser() {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { listCustomerKb().then(({ data }) => setArticles(data.items)).catch(() => setError("Could not load help articles.")); }, []);
  async function search(value: string) {
    setQuery(value);
    if (!value.trim()) { const result = await listCustomerKb(); setArticles(result.data.items); return; }
    try { const result = await searchCustomerKb(value); setArticles(result.data.items); setError(""); } catch { setError("Could not search help articles."); }
  }
  return <main className="portal-page"><section className="portal-card"><h1>Help center</h1><p>Find an answer before opening a ticket.</p><input className="text-field" aria-label="Search help articles" placeholder="Search articles" value={query} onChange={(event) => void search(event.target.value)} />{error && <p className="field-error" role="alert">{error}</p>}<div className="ticket-list">{articles.map((article) => <Link className="ticket-row" href={`/portal/kb/${article.slug}`} key={article.id}><strong>{article.title}</strong><span>{article.excerpt ?? "Read this article"}</span></Link>)}</div>{!articles.length && !error && <p className="empty-state">No matching articles.</p>}</section></main>;
}

