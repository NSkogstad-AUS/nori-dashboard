# Feature Flipper

Imported from Framer project `3fcf000c28773e3b` with `npx unframer 3fcf000c28773e3b`
from `apps/web`. Rendered below the persona shelf on the Journeys page.

The generated export references `runTasksWithYield`, which is absent from
Unframer 4.2.0. Its single-task loader is adapted to
`Promise.all([forwardLoader2(stdin_default5, {}, context)])`, preserving the
loader's asynchronous result without needing to yield between tasks. Reapply
this adjustment if re-exporting with the same runtime version.

The `journey-framer-feature` rules in the shared component stylesheet normalize
the original canvas's negative offsets and stack its panels on narrow screens.
The original component artwork, content, and interactions are retained.
