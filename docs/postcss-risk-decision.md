# Decision: postcss audit finding

## Context

`npm audit` reported a moderate `postcss` vulnerability through the dependency
tree:

- `next@16.2.3` declared `postcss@8.4.31`.
- `@tailwindcss/postcss@4.2.2` also resolved a vulnerable `postcss` version.

Checking the latest stable Next release available at the time did not solve the
issue because it still declared the older PostCSS version.

## Decision

Use an npm `overrides` entry to force `postcss@8.5.14` across the dependency
tree.

This keeps the current Next version stable while applying the patched PostCSS
release.

## Verification

- `npm ls postcss`: Next and Tailwind resolve to `postcss@8.5.14`.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- `npm run lint`: OK.
- `npm run build`: OK.

## Follow-up

When Next publishes a stable release that declares a patched PostCSS version
directly, the override can be removed after verifying `npm audit`, lint, and
build.
