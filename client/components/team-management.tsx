"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ApiError, apiJson } from "@/lib/api";

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  members: Array<{ userId: string; firstName: string; lastName: string; email: string; role: string }>;
}
interface Invitation { id: string; email: string; role: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; }
interface User { id: string; email: string; firstName: string; lastName: string; }

const messageFor = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : "Request failed.";

export function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [teamResult, userResult, invitationResult] = await Promise.all([
        apiJson<{ data: { teams: Team[] } }>("/teams"),
        apiJson<{ data: { users: User[] } }>("/users?limit=100"),
        apiJson<{ data: { invitations: Invitation[] } }>("/users/invitations"),
      ]);
      setTeams(teamResult.data.teams);
      setUsers(userResult.data.users);
      setInvitations(invitationResult.data.invitations);
      setError("");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createTeam() {
    if (!name.trim()) return;
    try {
      await apiJson("/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }) });
      setName(""); setSuccess("Team created."); await load();
    } catch (cause) { setError(messageFor(cause)); }
  }

  async function removeTeam(id: string) {
    try { await apiJson(`/teams/${id}`, { method: "DELETE" }); setSuccess("Team deleted."); await load(); }
    catch (cause) { setError(messageFor(cause)); }
  }

  async function addMember(teamId: string, userId: string) {
    try { await apiJson(`/teams/${teamId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role: "member" }) }); await load(); }
    catch (cause) { setError(messageFor(cause)); }
  }

  async function removeMember(teamId: string, userId: string) {
    try { await apiJson(`/teams/${teamId}/members/${userId}`, { method: "DELETE" }); await load(); }
    catch (cause) { setError(messageFor(cause)); }
  }

  async function invite() {
    if (!email.trim()) return;
    try { await apiJson("/users/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: "agent" }) }); setEmail(""); setSuccess("Invitation sent."); await load(); }
    catch (cause) { setError(messageFor(cause)); }
  }

  async function revoke(id: string) {
    try { await apiJson(`/users/invitations/${id}`, { method: "DELETE" }); await load(); }
    catch (cause) { setError(messageFor(cause)); }
  }

  return <AppShell>
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Team</h1><p className="page-subtitle">Organize staff into tenant-scoped queues and invite new agents.</p></div></div>
    {error && <div className="inline-alert" role="alert">{error}</div>}
    {success && <div className="inline-alert">{success}</div>}
    {loading ? <div className="management-loading">Loading team…</div> : <div className="management-grid">
      <section className="management-panel"><h2>Teams</h2><div className="management-form-actions"><input className="text-field" placeholder="New team name" value={name} onChange={(event) => setName(event.target.value)} /><button className="primary-button" type="button" onClick={() => void createTeam()}>Create</button></div>
        {teams.map((team) => <article className="management-list-item" key={team.id}><div><strong>{team.name}</strong><p>{team.members.length} members</p>{team.members.map((member) => <span className="workspace-readonly" key={member.userId}>{member.firstName} {member.lastName}<button className="text-button" type="button" onClick={() => void removeMember(team.id, member.userId)}>Remove</button></span>)}</div><div><select className="text-field" aria-label={`Add member to ${team.name}`} defaultValue="" onChange={(event) => { if (event.target.value) void addMember(team.id, event.target.value); }}><option value="">Add member…</option>{users.filter((user) => !team.members.some((member) => member.userId === user.id)).map((user) => <option value={user.id} key={user.id}>{user.firstName} {user.lastName}</option>)}</select><button className="quiet-button" type="button" onClick={() => void removeTeam(team.id)}>Delete</button></div></article>)}
      </section>
      <section className="management-panel"><h2>Invitations</h2><div className="management-form-actions"><input className="text-field" type="email" placeholder="agent@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="primary-button" type="button" onClick={() => void invite()}>Invite</button></div>{invitations.filter((item) => !item.acceptedAt && !item.revokedAt).map((item) => <div className="management-list-item" key={item.id}><span>{item.email}</span><button className="quiet-button" type="button" onClick={() => void revoke(item.id)}>Revoke</button></div>)}</section>
    </div>}
  </AppShell>;
}
