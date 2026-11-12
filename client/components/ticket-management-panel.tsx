"use client";

import { useEffect, useState } from "react";

import { ApiError, apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TicketCategory, TicketTag } from "@/lib/ticket-types";

export function TicketManagementPanel() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [tags, setTags] = useState<TicketTag[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [tagName, setTagName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [categoryResult, tagResult] = await Promise.all([
        apiJson<{ data: { categories: TicketCategory[] } }>("/tickets/categories"),
        apiJson<{ data: { tags: TicketTag[] } }>("/tickets/tags"),
      ]);
      setCategories(categoryResult.data.categories);
      setTags(tagResult.data.tags);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load ticket management data.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createCategory() {
    const name = categoryName.trim();
    if (!name) return;
    await apiJson("/tickets/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }),
    });
    setCategoryName("");
    await load();
  }

  async function createTag() {
    const name = tagName.trim();
    if (!name) return;
    await apiJson("/tickets/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }),
    });
    setTagName("");
    await load();
  }

  async function editCategory(category: TicketCategory) {
    const name = window.prompt("Category name", category.name)?.trim();
    if (!name || name === category.name) return;
    await apiJson(`/tickets/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }),
    });
    await load();
  }

  async function editTag(tag: TicketTag) {
    const name = window.prompt("Tag name", tag.name)?.trim();
    if (!name || name === tag.name) return;
    await apiJson(`/tickets/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }),
    });
    await load();
  }

  async function deleteItem(path: string) {
    if (!window.confirm("Delete this item?")) return;
    await apiJson(path, { method: "DELETE" });
    await load();
  }

  if (user?.role !== "admin") return null;

  return (
    <details className="management-panel ticket-management-panel">
      <summary>Manage categories and tags</summary>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="ticket-management-grid">
        <div>
          <h2>Categories</h2>
          <ul>{categories.map((category) => <li key={category.id}>{category.name} <button type="button" className="text-button" onClick={() => void editCategory(category)}>Edit</button> <button type="button" className="text-button" onClick={() => void deleteItem(`/tickets/categories/${category.id}`)}>Delete</button></li>)}</ul>
          <div className="inline-form">
            <input className="text-field" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category" />
            <button type="button" className="quiet-button" onClick={() => void createCategory()}>Add</button>
          </div>
        </div>
        <div>
          <h2>Tags</h2>
          <ul>{tags.map((tag) => <li key={tag.id}>{tag.name} <button type="button" className="text-button" onClick={() => void editTag(tag)}>Edit</button> <button type="button" className="text-button" onClick={() => void deleteItem(`/tickets/tags/${tag.id}`)}>Delete</button></li>)}</ul>
          <div className="inline-form">
            <input className="text-field" value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="New tag" />
            <button type="button" className="quiet-button" onClick={() => void createTag()}>Add</button>
          </div>
        </div>
      </div>
    </details>
  );
}
