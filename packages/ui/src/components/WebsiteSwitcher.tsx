// Small helper type used by Sidebar's site list and the Websites page — kept as its own module
// per plan/PHASE_2_PLAN.md section 3's component list, even though the rendering itself lives in
// Sidebar (prototype's `.rail-sites` list) — this exports the shared shape + a compact inline
// switcher used in PageHeader-adjacent contexts.

export interface WebsiteOption {
  id: string;
  name: string;
  mark: string;
  colorClass: string;
}

export interface WebsiteSwitcherProps {
  websites: WebsiteOption[];
  selectedWebsiteId: string;
  onSelect: (websiteId: string) => void;
}

export function WebsiteSwitcher({ websites, selectedWebsiteId, onSelect }: WebsiteSwitcherProps) {
  return (
    <div className="rail-sites" role="group" aria-label="Choose website">
      {websites.map((site) => (
        <button
          key={site.id}
          type="button"
          title={site.name}
          className={`website-link${site.id === selectedWebsiteId ? ' chosen' : ''}`}
          onClick={() => onSelect(site.id)}
        >
          <span className={`site-avatar ${site.colorClass}`}>{site.mark}</span>
          <strong>{site.name}</strong>
        </button>
      ))}
    </div>
  );
}
