// @nori/agent
//
// Phase 4 adds the navigation-safety half of the "bounded action policy" described in the
// implementation plan (section 5 "Contracts") — see ./safe-navigation.ts. The model adapter
// (Claude via the Anthropic API, tool use for action selection) and persona prompts described in
// the same section are still Phase 5's job ("One real persona agent, end to end").
//
// Do not add model calls or prompts here yet — only network-boundary safety policy belongs in
// this package until Phase 5.
export * from './safe-navigation';
