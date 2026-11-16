"use client";

import { useEffect, useState } from "react";

import { listKbVersions, restoreKbVersion, type KbVersion } from "@/lib/kb-api";

export function KbVersionHistory({ articleId, onRestored }: { articleId: string; onRestored: () => void }) {
  const [versions, setVersions] = useState<KbVersion[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { listKbVersions(articleId).then(({ data }) => setVersions(data.versions)).catch(() => setError("Could not load version history.")); }, [articleId]);
  async function restore(versionNumber: number) {
    if (!window.confirm(`Restore version ${versionNumber}? This creates a new immutable version.`)) return;
    try { await restoreKbVersion(articleId, versionNumber); onRestored(); } catch { setError("Could not restore this version."); }
  }
  return <aside className="management-panel"><h2>Version history</h2>{error && <p className="field-error" role="alert">{error}</p>}<ul className="simple-list">{versions.map((version) => <li key={version.id}><div><strong>Version {version.versionNumber}</strong><span>{version.changeSummary ?? "Snapshot"}</span></div><button className="secondary-button" type="button" onClick={() => restore(version.versionNumber)}>Restore</button></li>)}</ul></aside>;
}

