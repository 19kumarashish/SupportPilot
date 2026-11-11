"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ApiError, apiJson } from "@/lib/api";

interface Settings { supportEmail: string | null; defaultSlaPolicyId: string | null; autoAssignEnabled: boolean; aiAssistanceEnabled: boolean; timezone: string; }
interface Policy { id: string; name: string; priority: string; firstResponseMinutes: number; resolutionMinutes: number; }

export function WorkspaceSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [policyDraft, setPolicyDraft] = useState({ name: "", priority: "medium", firstResponseMinutes: "60", resolutionMinutes: "1440" });

  useEffect(() => {
    Promise.all([
      apiJson<{ data: { settings: Settings } }>("/organizations/settings"),
      apiJson<{ data: { policies: Policy[] } }>("/sla/policies"),
    ]).then(([settingsResult, policyResult]) => { setSettings(settingsResult.data.settings); setPolicies(policyResult.data.policies); })
      .catch((cause: unknown) => setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Could not load settings."));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try { const result = await apiJson<{ data: { settings: Settings } }>("/organizations/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); setSettings(result.data.settings); }
    catch (cause) { setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Could not save settings."); }
    finally { setSaving(false); }
  }

  async function createPolicy() {
    try {
      await apiJson("/sla/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...policyDraft, firstResponseMinutes: Number(policyDraft.firstResponseMinutes), resolutionMinutes: Number(policyDraft.resolutionMinutes), isDefault: false }) });
      const result = await apiJson<{ data: { policies: Policy[] } }>("/sla/policies");
      setPolicies(result.data.policies);
      setPolicyDraft({ ...policyDraft, name: "" });
    } catch (cause) { setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Could not create SLA policy."); }
  }

  async function deletePolicy(id: string) {
    try { await apiJson(`/sla/policies/${id}`, { method: "DELETE" }); setPolicies(policies.filter((policy) => policy.id !== id)); }
    catch (cause) { setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Could not delete SLA policy."); }
  }

  return <AppShell><div className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Settings</h1><p className="page-subtitle">Persisted organization controls and SLA defaults.</p></div></div>{error && <div className="inline-alert" role="alert">{error}</div>}{settings && <section className="management-panel"><h2>Organization settings</h2><label className="field-label" htmlFor="support-email">Support email</label><input id="support-email" className="text-field" type="email" value={settings.supportEmail ?? ""} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value || null })} /><label className="field-label" htmlFor="timezone">Timezone</label><input id="timezone" className="text-field" value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} /><label className="field-label" htmlFor="default-sla">Default SLA policy</label><select id="default-sla" className="text-field" value={settings.defaultSlaPolicyId ?? ""} onChange={(event) => setSettings({ ...settings, defaultSlaPolicyId: event.target.value || null })}><option value="">No default</option>{policies.map((policy) => <option value={policy.id} key={policy.id}>{policy.name} ({policy.priority})</option>)}</select><label className="workspace-readonly"><input type="checkbox" checked={settings.autoAssignEnabled} onChange={(event) => setSettings({ ...settings, autoAssignEnabled: event.target.checked })} /> Auto-assign tickets</label><label className="workspace-readonly"><input type="checkbox" checked={settings.aiAssistanceEnabled} onChange={(event) => setSettings({ ...settings, aiAssistanceEnabled: event.target.checked })} /> Enable AI assistance</label><button className="primary-button" type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></section>}<section className="management-panel"><h2>SLA policies</h2><div className="management-form-actions"><input className="text-field" placeholder="Policy name" value={policyDraft.name} onChange={(event) => setPolicyDraft({ ...policyDraft, name: event.target.value })} /><select className="text-field" value={policyDraft.priority} onChange={(event) => setPolicyDraft({ ...policyDraft, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select><input className="text-field" type="number" min="1" placeholder="First response minutes" value={policyDraft.firstResponseMinutes} onChange={(event) => setPolicyDraft({ ...policyDraft, firstResponseMinutes: event.target.value })} /><input className="text-field" type="number" min="1" placeholder="Resolution minutes" value={policyDraft.resolutionMinutes} onChange={(event) => setPolicyDraft({ ...policyDraft, resolutionMinutes: event.target.value })} /><button className="primary-button" type="button" onClick={() => void createPolicy()}>Add policy</button></div>{policies.map((policy) => <div className="management-list-item" key={policy.id}><span>{policy.name} · {policy.priority}</span><span>{policy.firstResponseMinutes}m response / {policy.resolutionMinutes}m resolution <button className="text-button" type="button" onClick={() => void deletePolicy(policy.id)}>Delete</button></span></div>)}</section></AppShell>;
}
