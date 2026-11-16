import { apiJson } from "@/lib/api";

export type KbStatus = "draft" | "published" | "archived";
export type KbVisibility = "public" | "customers_only" | "internal_staff";

export interface KbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface KbArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  currentBody: string;
  status: KbStatus;
  visibility: KbVisibility;
  categoryId: string | null;
  publishedVersionNumber: number;
}

export interface KbVersion {
  id: string;
  versionNumber: number;
  title: string;
  body: string;
  changeSummary: string | null;
  createdAt: string;
}

interface Collection<T> {
  items: T[];
  total: number;
}

export const listKbArticles = (query = "") =>
  apiJson<{ success: true; data: Collection<KbArticle> }>(`/kb/articles${query}`);

export const listKbCategories = () =>
  apiJson<{ success: true; data: { categories: KbCategory[] } }>("/kb/categories");

export const getKbArticle = (id: string) =>
  apiJson<{ success: true; data: { article: KbArticle } }>(`/kb/articles/${id}`);

export const createKbArticle = (input: {
  title: string;
  slug: string;
  current_body: string;
  visibility: KbVisibility;
  excerpt?: string;
  category_id?: string;
}) =>
  apiJson<{ success: true; data: { article: KbArticle } }>("/kb/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const updateKbArticle = (id: string, input: Partial<Parameters<typeof createKbArticle>[0]>) =>
  apiJson<{ success: true; data: { article: KbArticle } }>(`/kb/articles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const publishKbArticle = (id: string, change_summary?: string) =>
  apiJson<{ success: true; data: { article: KbArticle } }>(`/kb/articles/${id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change_summary ? { change_summary } : {}),
  });

export const archiveKbArticle = (id: string) =>
  apiJson<{ success: true; data: { article: KbArticle } }>(`/kb/articles/${id}/archive`, { method: "POST" });

export const listKbVersions = (id: string) =>
  apiJson<{ success: true; data: { versions: KbVersion[] } }>(`/kb/articles/${id}/versions`);

export const restoreKbVersion = (id: string, versionNumber: number) =>
  apiJson<{ success: true; data: { article: KbArticle } }>(`/kb/articles/${id}/versions/${versionNumber}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

