// Ports prototype/app.js `runCards()`'s `.run-card` + `.new-run-card` markup.

export interface RunCardProps {
  websiteUrl: string;
  title: string;
  date: string;
  colorClass: string;
  personaEmojis: string[];
  /** "Setup only" tag for a pending run created via the New Run dialog. */
  pending: boolean;
  flaggedCount: number;
  onOpen: () => void;
}

export function RunCard({
  websiteUrl,
  title,
  date,
  colorClass,
  personaEmojis,
  pending,
  flaggedCount,
  onOpen,
}: RunCardProps) {
  return (
    <button type="button" className="run-card" onClick={onOpen}>
      <div className={`run-art ${colorClass}`}>
        <span className="site-avatar">{websiteUrl.charAt(0).toUpperCase()}</span>
        <div className="art-people">
          {personaEmojis.map((emoji, index) => (
            <span key={index}>{emoji}</span>
          ))}
        </div>
      </div>
      <div className="run-card-copy">
        <span className="subtle">{websiteUrl}</span>
        <h2>{title}</h2>
        <p>{date}</p>
        <footer>
          <span className="tag">{pending ? 'Setup only' : `${flaggedCount} flagged moments`}</span>
          <span>Explore ↗</span>
        </footer>
      </div>
    </button>
  );
}

export interface NewRunCardProps {
  onCreate: () => void;
}

export function NewRunCard({ onCreate }: NewRunCardProps) {
  return (
    <button type="button" className="new-run-card" onClick={onCreate}>
      <span>＋</span>
      <strong>Another fresh perspective</strong>
      <small>Set up a sample run</small>
    </button>
  );
}
