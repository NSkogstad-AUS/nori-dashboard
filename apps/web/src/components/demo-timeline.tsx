'use client';

const DEMO_STEPS = [
  { id: 1, title: 'Navigate Home & Journey', source: '/demos/nori1.mp4' },
  { id: 2, title: 'Open Home & add a website', source: '/demos/nori2.mp4' },
  { id: 3, title: 'Add your website', source: '/demos/nori3.mp4' },
  { id: 4, title: 'Choose a persona', source: '/demos/nori4.mp4' },
  { id: 5, title: 'Run, review & finish', source: '/demos/nori5.mp4' },
];

export function DemoTimeline() {
  return (
    <section className="demo-page" aria-labelledby="demo-title">
      <h2 id="demo-title">Five steps from first click to finished journey</h2>
      <ol className="demo-timeline">
        {DEMO_STEPS.map((step) => (
          <li key={step.id} className="demo-step">
            <div className="demo-step-heading">
              <span>{String(step.id).padStart(2, '0')}</span>
              <strong>{step.title}</strong>
            </div>
            <div className="demo-player">
              <video controls preload="metadata" playsInline aria-label={`Demo ${step.id}: ${step.title}`}>
                <source src={step.source} type="video/mp4" />
              </video>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
