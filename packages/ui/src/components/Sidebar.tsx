'use client';

// Ports prototype/app.js `render()`'s `<aside class="rail">` markup — sidebar nav, website
// switcher list, collapse toggle, workspace footer. See plan/PHASE_2_PLAN.md section 6.

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}

export interface SidebarSiteItem {
  id: string;
  name: string;
  mark: string;
  colorClass: string;
  active: boolean;
}

export interface SidebarProps {
  navItems: SidebarNavItem[];
  siteItems: SidebarSiteItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectSite: (siteId: string) => void;
  /** Renders nav items as plain anchors; caller supplies a Link-rendering wrapper if desired. */
  renderNavLink?: (item: SidebarNavItem, children: React.ReactNode) => React.ReactNode;
}

export function Sidebar({
  navItems,
  siteItems,
  collapsed,
  onToggleCollapsed,
  onSelectSite,
  renderNavLink,
}: SidebarProps) {
  return (
    <aside className="rail">
      <a className="wordmark" href="/" aria-label="Nori">
        <span>n.</span>
        <strong>Nori</strong>
      </a>
      <button
        type="button"
        className="rail-toggle circle"
        aria-label="Toggle sidebar"
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        ☰
      </button>
      <nav aria-label="Workspace">
        {navItems.map((item) => {
          const content = (
            <>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </>
          );
          const linkClass = `rail-link${item.active ? ' active' : ''}`;
          if (renderNavLink) {
            return (
              <span key={item.href} className={linkClass} title={item.label}>
                {renderNavLink(item, content)}
              </span>
            );
          }
          return (
            <a
              key={item.href}
              href={item.href}
              title={item.label}
              className={linkClass}
              aria-current={item.active ? 'page' : undefined}
            >
              {content}
            </a>
          );
        })}
      </nav>
      <div className="rail-sites">
        <span className="rail-label">Your websites</span>
        {siteItems.map((site) => (
          <button
            key={site.id}
            type="button"
            title={site.name}
            className={`website-link${site.active ? ' chosen' : ''}`}
            onClick={() => onSelectSite(site.id)}
          >
            <span className={`site-avatar ${site.colorClass}`}>{site.mark}</span>
            <strong>{site.name}</strong>
          </button>
        ))}
      </div>
      <div className="rail-bottom">
        <span className="avatar">Y</span>
        <strong>
          Your workspace
          <small>Personal, demo workspace</small>
        </strong>
      </div>
    </aside>
  );
}
