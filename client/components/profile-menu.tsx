"use client";

import { ChevronDown, LogOut } from "lucide-react";

interface ProfileMenuProps {
  name: string;
  email: string;
  role: string;
  onSignOut(): Promise<void>;
}

export function ProfileMenu({
  name,
  email,
  role,
  onSignOut,
}: ProfileMenuProps) {
  const initials = name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <details className="profile-menu">
      <summary className="profile-trigger" aria-label={`Account menu for ${name}`}>
        <span className="user-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="profile-trigger-copy">
          <strong>{name}</strong>
          <small>{role}</small>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="profile-panel">
        <div className="profile-panel-copy">
          <strong>{name}</strong>
          <span>{email}</span>
          <small>{role}</small>
        </div>
        <button
          className="profile-sign-out"
          type="button"
          onClick={() => void onSignOut()}
        >
          <LogOut size={15} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </details>
  );
}
