"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCustomerKbArticle, submitCustomerKbFeedback } from "@/lib/customer-kb-api";
import type { KbArticle } from "@/lib/kb-api";

export function PortalKbArticle({ slug }: { slug: string }) {
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { getCustomerKbArticle(slug).then(({ data }) => setArticle(data.article)).catch(() => setMessage("This article is not available.")); }, [slug]);
  async function feedback(helpful: boolean) {
    if (!article) return;
    try { await submitCustomerKbFeedback(article.id, helpful); setMessage("Thanks for your feedback."); } catch { setMessage("Could not record feedback."); }
  }
  if (!article) return <main className="portal-page"><section className="portal-card"><Link href="/portal/kb">Back to help center</Link><p role={message ? "alert" : undefined}>{message || "Loading article…"}</p></section></main>;
  return <main className="portal-page"><article className="portal-card"><Link href="/portal/kb">Back to help center</Link><h1>{article.title}</h1>{article.excerpt && <p>{article.excerpt}</p>}<div style={{ whiteSpace: "pre-wrap" }}>{article.currentBody}</div><hr /><p>Was this helpful?</p><button className="secondary-button" type="button" onClick={() => void feedback(true)}>Yes</button>{" "}<button className="secondary-button" type="button" onClick={() => void feedback(false)}>No</button>{message && <p role="status">{message}</p>}</article></main>;
}

