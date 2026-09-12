// Ports prototype/app.js `browserFrame(person,frame,thumbnail)` — the simulated browser scene
// markup for one stage's mock content. Frame content (`mock-hero`/`mock-pricing`/`mock-form`/
// `mock-project`) is static per stage index, matching the prototype (it isn't persona-specific
// beyond the name/email substitution already present there).
//
// Adds an "artifact unavailable" placeholder state per plan/PHASE_2_PLAN.md section 7 — nothing
// in Phase 2 triggers it from real async data, but the state must exist and be styled now.

export interface BrowserViewportProps {
  personName: string;
  colorClass: string;
  stageIndex: number;
  stageName: string;
  thumbnail?: boolean;
  /** When true, renders the "artifact unavailable" placeholder instead of the mock scene. */
  unavailable?: boolean;
}

function FrameContent({ stageIndex, personName }: { stageIndex: number; personName: string }) {
  switch (stageIndex) {
    case 0:
      return (
        <div className="mock-hero">
          <small>A little space for your best work</small>
          <h3>
            Good ideas.
            <br />
            Room to grow.
          </h3>
          <p>A calm place to bring your projects together.</p>
          <span className="mock-cta">Find your workspace ↗</span>
          <div className="mock-shapes">
            <i></i>
            <i></i>
            <i></i>
          </div>
        </div>
      );
    case 1:
      return (
        <div className="mock-pricing">
          <h3>A plan for your next chapter.</h3>
          <div className="mock-plans">
            <section>
              <small>Personal</small>
              <strong>
                $12 <em>/ month</em>
              </strong>
              <p>Your projects, in one place.</p>
              <span className="mock-cta">Choose Personal</span>
            </section>
            <section>
              <small>Team</small>
              <strong>
                $24 <em>/ month</em>
              </strong>
              <p>A little more room to collaborate.</p>
              <span className="mock-cta">Choose Team</span>
            </section>
          </div>
        </div>
      );
    case 2:
      return (
        <div className="mock-form">
          <small>Make yourself at home</small>
          <h3>
            Your next chapter
            <br />
            starts here.
          </h3>
          <div className="mock-field">
            <small>Your name</small>
            <span>{personName}</span>
          </div>
          <div className="mock-field">
            <small>Email address</small>
            <span>{personName.toLowerCase()}@example.com</span>
          </div>
          <span className="mock-cta">Continue →</span>
          <p>By continuing, you agree to the terms.</p>
        </div>
      );
    default:
      return (
        <div className="mock-project">
          <small>Your workspace</small>
          <h3>A fresh start, {personName}.</h3>
          <p>What would you like to work on?</p>
          <div className="mock-plans">
            <section>
              <strong>＋</strong>Create a project
            </section>
            <section>
              <strong>↗</strong>Explore the guide
            </section>
          </div>
        </div>
      );
  }
}

export function BrowserViewport({
  personName,
  colorClass,
  stageIndex,
  stageName,
  thumbnail = false,
  unavailable = false,
}: BrowserViewportProps) {
  if (unavailable) {
    return (
      <div
        className={`browser-scene ${colorClass} artifact-unavailable${thumbnail ? ' thumbnail' : ''}`}
        role="status"
      >
        <span className="empty-state-icon" aria-hidden="true">
          ◫
        </span>
        <strong>Artifact unavailable</strong>
        <p>This frame hasn&rsquo;t been captured yet.</p>
      </div>
    );
  }

  return (
    <div
      className={`browser-scene ${colorClass} frame-${stageIndex}${thumbnail ? ' thumbnail' : ''}`}
      {...(thumbnail
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': `Simulated ${stageName} browser screen for ${personName}` })}
    >
      <div className="mock-nav">
        <b>forma.</b>
        <span>Product &nbsp; Pricing &nbsp; About</span>
        <i>Get started ↗</i>
      </div>
      <FrameContent stageIndex={stageIndex} personName={personName} />
      <div className={`demo-cursor cursor-${stageIndex}`}>
        <span>➤</span>
        <small>{personName}</small>
      </div>
    </div>
  );
}
