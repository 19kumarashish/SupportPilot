"use client";

import { useEffect, useState } from "react";

import { listKbCategories, type KbCategory } from "@/lib/kb-api";

export function KbCategoryManager() {
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    listKbCategories().then(({ data }) => setCategories(data.categories)).catch(() => setError("Could not load categories."));
  }, []);
  return <section className="management-panel"><h1>KB categories</h1>{error && <p className="field-error" role="alert">{error}</p>}<ul className="simple-list">{categories.map((category) => <li key={category.id}><strong>{category.name}</strong><span>{category.slug}</span></li>)}</ul>{!categories.length && !error && <p className="empty-state">No categories yet.</p>}</section>;
}

