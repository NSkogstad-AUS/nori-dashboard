'use client';

// Ports prototype/app.js `render()`'s `<aside class="rail">` markup — sidebar nav, website
// switcher list, collapse toggle, workspace footer. See plan/PHASE_2_PLAN.md section 6.

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}

export interface SidebarProps {
  navItems: SidebarNavItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Renders nav items as plain anchors; caller supplies a Link-rendering wrapper if desired. */
  renderNavLink?: (item: SidebarNavItem, children: React.ReactNode) => React.ReactNode;
}

function SidebarNavIcon({ name }: { name: string }) {
  const iconProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'home') {
    return (
      <svg {...iconProps}>
        <path d="M3.5 10.5 12 3.8l8.5 6.7" />
        <path d="M5.5 9.5v10.2h13V9.5M9.5 19.7v-6h5v6" />
      </svg>
    );
  }
  if (name === 'journeys') {
    return (
      <svg {...iconProps}>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="M8 6h4a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H9a3 3 0 0 0-3 3v0" />
      </svg>
    );
  }
  if (name === 'runs') {
    return (
      <svg {...iconProps}>
        <path d="M5 5h14M5 12h14M5 19h14" />
        <circle cx="8" cy="5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="10" cy="19" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9S9.6 18.5 12 21" />
    </svg>
  );
}

export function Sidebar({
  navItems,
  collapsed,
  onToggleCollapsed,
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
              <span className="rail-link-icon">
                <SidebarNavIcon name={item.icon} />
              </span>
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
