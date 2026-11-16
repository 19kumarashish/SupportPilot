import { customerApiJson } from "@/lib/customer-auth";
import type { KbArticle, KbCategory } from "@/lib/kb-api";

export const searchCustomerKb = (query: string) =>
  customerApiJson<{ success: true; data: { items: KbArticle[]; total: number } }>(
    `/customer/kb/search?q=${encodeURIComponent(query)}`,
  );

export const listCustomerKb = () =>
  customerApiJson<{ success: true; data: { items: KbArticle[]; total: number } }>("/customer/kb/articles");

export const listCustomerKbCategories = () =>
  customerApiJson<{ success: true; data: { categories: KbCategory[] } }>("/customer/kb/categories");

export const getCustomerKbArticle = (slug: string) =>
  customerApiJson<{ success: true; data: { article: KbArticle } }>(
    `/customer/kb/articles/by-slug/${encodeURIComponent(slug)}`,
  );

export const submitCustomerKbFeedback = (id: string, helpful: boolean) =>
  customerApiJson(`/customer/kb/articles/${id}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ helpful }),
  });

