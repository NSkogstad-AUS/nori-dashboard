// @nori/ui — Phase 2 component set.
//
// This package is intentionally framework-agnostic for styling: design tokens and component
// CSS are plain stylesheets, not CSS-in-JS, so consumers import them directly rather than via
// this module. Import them once at the root of apps/web (in app/layout.tsx):
//
//   import '@nori/ui/src/tokens/tokens.css';
//   import '@nori/ui/src/tokens/motion.css';
//   import '@nori/ui/src/styles/components.css';
//
// React components are re-exported below.

export { Dialog } from './components/Dialog';
export type { DialogProps } from './components/Dialog';

export { FixtureModeBadge } from './components/FixtureModeBadge';
export type { FixtureModeBadgeProps, FixtureModeBadgeVariant } from './components/FixtureModeBadge';

export { AppShell } from './components/AppShell';
export type { AppShellProps } from './components/AppShell';

export { Sidebar } from './components/Sidebar';
export type { SidebarProps, SidebarNavItem, SidebarSiteItem } from './components/Sidebar';

export { WebsiteSwitcher } from './components/WebsiteSwitcher';
export type { WebsiteSwitcherProps, WebsiteOption } from './components/WebsiteSwitcher';

export { PageHeader } from './components/PageHeader';
export type { PageHeaderProps } from './components/PageHeader';

export { FloatingDock } from './components/FloatingDock';
export type { FloatingDockProps } from './components/FloatingDock';

export { PersonaShelf } from './components/PersonaShelf';
export type { PersonaShelfProps, PersonaShelfPerson } from './components/PersonaShelf';

export { PersonaPill } from './components/PersonaPill';
export type { PersonaPillProps } from './components/PersonaPill';

export { PersonaCard } from './components/PersonaCard';
export type { PersonaCardProps } from './components/PersonaCard';

export { JourneyViewSwitch } from './components/JourneyViewSwitch';
export type { JourneyViewSwitchProps } from './components/JourneyViewSwitch';

export { JourneyStage } from './components/JourneyStage';
export type { JourneyStageProps } from './components/JourneyStage';

export { JourneyStep } from './components/JourneyStep';
export type { JourneyStepProps } from './components/JourneyStep';

export { RunCard, NewRunCard } from './components/RunCard';
export type { RunCardProps, NewRunCardProps } from './components/RunCard';

export { NewRunDialog } from './components/NewRunDialog';
export type {
  NewRunDialogProps,
  NewRunPersonaOption,
  NewRunSubmission,
} from './components/NewRunDialog';

export { NewWebsiteDialog } from './components/NewWebsiteDialog';
export type { NewWebsiteDialogProps, NewWebsiteSubmission } from './components/NewWebsiteDialog';

export { FindingDrawer } from './components/FindingDrawer';
export type { FindingDrawerProps } from './components/FindingDrawer';

export { PersonaLibraryDialog } from './components/PersonaLibraryDialog';
export type {
  PersonaLibraryDialogProps,
  PersonaLibraryEntry,
} from './components/PersonaLibraryDialog';

export { BrowserViewport } from './components/BrowserViewport';
export type { BrowserViewportProps } from './components/BrowserViewport';

export { PlaybackControls } from './components/PlaybackControls';
export type { PlaybackControlsProps } from './components/PlaybackControls';

export { CaptureStrip } from './components/CaptureStrip';
export type { CaptureStripProps } from './components/CaptureStrip';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps, EmptyStateTone } from './components/EmptyState';
