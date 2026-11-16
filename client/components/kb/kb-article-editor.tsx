"use client";

import { useEffect, useState } from "react";

import { createKbArticle, getKbArticle, publishKbArticle, archiveKbArticle, updateKbArticle, type KbVisibility } from "@/lib/kb-api";
import { KbVersionHistory } from "./kb-version-history";

export function KbArticleEditor({ articleId }: { articleId?: string }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<KbVisibility>("public");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!articleId) return;
    getKbArticle(articleId).then(({ data }) => { setTitle(data.article.title); setSlug(data.article.slug); setBody(data.article.currentBody); setVisibility(data.article.visibility); }).catch(() => setError("Could not load this article."));
  }, [articleId]);

  async function save() {
    setError(""); setSaved("");
    try {
      if (articleId) await updateKbArticle(articleId, { title, slug, current_body: body, visibility });
      else await createKbArticle({ title, slug, current_body: body, visibility });
      setSaved("Saved.");
    } catch { setError("Could not save this article."); }
  }
  async function transition(action: "publish" | "archive") {
    if (!articleId) return;
    try { if (action === "publish") await publishKbArticle(articleId); else await archiveKbArticle(articleId); setSaved(action === "publish" ? "Published." : "Archived."); } catch { setError(`Could not ${action} this article.`); }
  }

  return <div className="management-form-grid"><section className="management-panel"><h1>{articleId ? "Edit article" : "New article"}</h1>{error && <p className="field-error" role="alert">{error}</p>}{saved && <p role="status">{saved}</p>}<label className="field-label" htmlFor="kb-title">Title</label><input id="kb-title" className="text-field" value={title} onChange={(event) => setTitle(event.target.value)} /><label className="field-label" htmlFor="kb-slug">Slug</label><input id="kb-slug" className="text-field" value={slug} onChange={(event) => setSlug(event.target.value)} /><label className="field-label" htmlFor="kb-visibility">Visibility</label><select id="kb-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as KbVisibility)}><option value="public">Public</option><option value="customers_only">Customers only</option><option value="internal_staff">Internal staff</option></select><div className="management-form-grid"><div><label className="field-label" htmlFor="kb-body">Markdown</label><textarea id="kb-body" className="text-field" rows={14} value={body} onChange={(event) => setBody(event.target.value)} /></div><div><label className="field-label">Live preview</label><article className="portal-card" style={{ whiteSpace: "pre-wrap" }}>{body || "Preview appears here."}</article></div></div><div className="management-form-actions"><button className="primary-button" type="button" onClick={save}>Save</button>{articleId && <><button className="secondary-button" type="button" onClick={() => transition("publish")}>Publish</button><button className="secondary-button" type="button" onClick={() => transition("archive")}>Archive</button></>}</div></section>{articleId && <KbVersionHistory articleId={articleId} onRestored={() => getKbArticle(articleId).then(({ data }) => { setTitle(data.article.title); setBody(data.article.currentBody); })} />}</div>;
}

