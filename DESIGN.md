# Design

This package exposes explicit Webpack configuration fragments.

There is no default preset.
Webpack configuration affects build output and must be visible at the project boundary.

Production-only behavior must be guarded by an explicit `if (tooling.isProductionMode)` block in the project config.

Do not add broad aggregation methods.
Do not add generic merge escape hatches unless a specific audited use case cannot be expressed by a targeted method.
