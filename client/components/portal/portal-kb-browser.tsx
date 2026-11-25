"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { askCustomerAi, type CustomerAskResult } from "@/lib/customer-ai-api";
import { listCustomerKb, searchCustomerKb } from "@/lib/customer-kb-api";
import type { KbArticle } from "@/lib/kb-api";

export function PortalKbBrowser() {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [error, setError] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResult, setAiResult] = useState<CustomerAskResult | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    listCustomerKb()
      .then(({ data }) => setArticles(data.items))
      .catch(() => setError("Could not load help articles."));
  }, []);

  async function search(value: string) {
    setQuery(value);
    if (!value.trim()) {
      const result = await listCustomerKb();
      setArticles(result.data.items);
      return;
    }
    try {
      const result = await searchCustomerKb(value);
      setArticles(result.data.items);
      setError("");
    } catch {
      setError("Could not search help articles.");
    }
  }

  async function askAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = aiQuestion.trim();
    if (!trimmed) return;
    setAiBusy(true);
    setAiError("");
    try {
      const { data } = await askCustomerAi(trimmed);
      setAiResult(data);
    } catch {
      setAiError("Could not reach SupportPilot AI right now.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <main className="portal-page">
      <section className="portal-card">
        <h1>Help center</h1>
        <p>Find an answer before opening a ticket.</p>

        <form className="management-form" onSubmit={askAi} aria-label="Ask SupportPilot AI">
          <label className="field-label" htmlFor="portal-ai-question">Ask SupportPilot AI</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="portal-ai-question"
              className="text-field"
              placeholder="Ask a support question…"
              value={aiQuestion}
              onChange={(event) => setAiQuestion(event.target.value)}
            />
            <button className="primary-button" type="submit" disabled={aiBusy || !aiQuestion.trim()}>
              {aiBusy ? "Thinking…" : "Ask AI"}
            </button>
          </div>
          {aiError && <p className="field-error" role="alert">{aiError}</p>}
          {aiResult && (
            <div className="portal-card" aria-live="polite">
              {aiResult.handedOff ? (
                <>
                  <p>{aiResult.message}</p>
                  <Link className="primary-button" href="/portal/tickets/new">
                    Open a support ticket
                  </Link>
                </>
              ) : (
                <>
                  <p>{aiResult.answer}</p>
                  {aiResult.citations && aiResult.citations.length > 0 && (
                    <ul>
                      {aiResult.citations.map((citation) => (
                        <li key={citation.articleId}>
                          <Link href={`/portal/kb/${citation.slug}`}>{citation.title}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </form>

        <input
          className="text-field"
          aria-label="Search help articles"
          placeholder="Search articles"
          value={query}
          onChange={(event) => void search(event.target.value)}
        />
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="ticket-list">
          {articles.map((article) => (
            <Link className="ticket-row" href={`/portal/kb/${article.slug}`} key={article.id}>
              <strong>{article.title}</strong>
              <span>{article.excerpt ?? "Read this article"}</span>
            </Link>
          ))}
        </div>
        {!articles.length && !error && <p className="empty-state">No matching articles.</p>}
      </section>
    </main>
  );
}
