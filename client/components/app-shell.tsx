"use client";

import {
  Building2,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Settings2,
  Ticket,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ProfileMenu } from "@/components/profile-menu";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, unavailable, retrySession, signOut } = useAuth();
  const organizationId = user?.organizationId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspace, setWorkspace] = useState<{
    name: string;
    slug: string;
  } | null>(null);
  const [workspaceUnavailable, setWorkspaceUnavailable] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const previousMenuOpen = useRef(false);

  useEffect(() => {
    if (ready && !user && !unavailable) router.replace("/login");
  }, [ready, user, unavailable, router]);

  useEffect(() => {
    if (!organizationId) return;

    const controller = new AbortController();
    apiJson<{ data: { organization: { name: string; slug: string } } }>(
      "/organizations/me",
      { signal: controller.signal },
    )
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setWorkspace({
            name: data.organization.name,
            slug: data.organization.slug,
          });
          setWorkspaceUnavailable(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWorkspace(null);
          setWorkspaceUnavailable(true);
        }
      });

    return () => controller.abort();
  }, [organizationId]);

  const closeMobileNavigation = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    if (previousMenuOpen.current && !menuOpen) {
      menuToggleRef.current?.focus();
    }
    previousMenuOpen.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current
      ?.querySelector<HTMLElement>(".mobile-drawer-close")
      ?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNavigation();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileNavigation, menuOpen]);

  if (!ready || !user) {
    return (
      <main className="page-loading" aria-live="polite">
        <span className="loading-mark" aria-hidden="true" />
        {unavailable ? (
          <>
            <p role="alert">SupportPilot could not verify your session. Your saved session has been kept.</p>
            <button className="primary-button" type="button" onClick={retrySession}>
              Retry connection
            </button>
            <Link href="/login">Go to sign in</Link>
          </>
        ) : (
          <p>Opening your workspace…</p>
        )}
      </main>
    );
  }

  return (
    <div className="app-frame">
      <button
        ref={menuToggleRef}
        className="mobile-menu-toggle"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => {
          if (menuOpen) closeMobileNavigation();
          else setMenuOpen(true);
        }}
      >
        {menuOpen ? <X size={19} /> : <Menu size={19} />}
      </button>
      {menuOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={closeMobileNavigation}
        />
      )}
      <aside
        ref={sidebarRef}
        id="primary-navigation"
        className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
        aria-label="Workspace navigation"
      >
        <button
          className="mobile-drawer-close"
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileNavigation}
        >
          <X size={19} />
        </button>
        <Link className="brand" href="/" aria-label="SupportPilot dashboard" onClick={closeMobileNavigation}>
          <span className="brand-symbol"><LifeBuoy size={19} strokeWidth={2.2} /></span>
          <span>support<span className="brand-light">pilot</span></span>
        </Link>

        <div className="workspace-switcher">
          <span className="workspace-avatar">
            {workspace?.name.slice(0, 1).toUpperCase() ?? "W"}
          </span>
          <span className="workspace-copy">
            <strong>{workspace?.name ?? "Workspace"}</strong>
            <small>
              {workspace?.slug ??
                (workspaceUnavailable ? "Name unavailable" : "Loading workspace")}
            </small>
          </span>
        </div>

        <p className="nav-section-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link
            href="/"
            className={`nav-link ${pathname === "/" ? "nav-link-active" : ""}`}
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={closeMobileNavigation}
          >
            <LayoutDashboard size={17} strokeWidth={1.9} />
            <span>Overview</span>
          </Link>
          <Link
            href="/tickets"
            className={`nav-link ${pathname.startsWith("/tickets") ? "nav-link-active" : ""}`}
            aria-current={pathname.startsWith("/tickets") ? "page" : undefined}
            onClick={closeMobileNavigation}
          >
            <Ticket size={17} strokeWidth={1.9} />
            <span>Inbox</span>
          </Link>
          <Link
            href="/customers"
            className={`nav-link ${pathname.startsWith("/customers") ? "nav-link-active" : ""}`}
            aria-current={pathname.startsWith("/customers") ? "page" : undefined}
            onClick={closeMobileNavigation}
          >
            <Building2 size={17} strokeWidth={1.9} />
            <span>Customers</span>
          </Link>
          <Link
            href="/team"
            className={`nav-link ${pathname.startsWith("/team") ? "nav-link-active" : ""}`}
            aria-current={pathname.startsWith("/team") ? "page" : undefined}
            onClick={closeMobileNavigation}
          >
            <UsersRound size={17} strokeWidth={1.9} />
            <span>Team</span>
          </Link>
          <Link
            href="/settings"
            className={`nav-link ${pathname.startsWith("/settings") ? "nav-link-active" : ""}`}
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            onClick={closeMobileNavigation}
          >
            <Settings2 size={17} strokeWidth={1.9} />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-row">
            <LifeBuoy size={16} />
            <span>Support workspace</span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>SupportPilot</li>
              <li className="breadcrumb-divider" aria-hidden="true">/</li>
              <li aria-current="page">
                {pathname === "/"
                  ? "Overview"
                  : pathname.startsWith("/tickets")
                  ? "Inbox"
                  : pathname.startsWith("/customers")
                    ? "Customers"
                    : pathname.startsWith("/team")
                      ? "Team"
                      : pathname.startsWith("/settings")
                        ? "Settings"
                        : "Workspace"}
              </li>
            </ol>
          </nav>
          <ProfileMenu
            name={`${user.firstName} ${user.lastName}`}
            email={user.email}
            role={user.role}
            onSignOut={async () => {
              await signOut();
              router.replace("/login");
            }}
          />
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
