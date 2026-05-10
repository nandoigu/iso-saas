# Decision: Excel import/export dependency

## Context

`npm audit` reported vulnerabilities in the previous `xlsx` package with no
fixed version available in that package line.

The product requirement remains unchanged: users must keep working with normal
Microsoft Excel `.xlsx` files.

## Decision

Replace the internal `xlsx` dependency with `exceljs` while keeping the user
experience based on `.xlsx` files.

Users still upload and download Excel-compatible `.xlsx` files. The app now
uses a different parser/writer internally.

## Implemented

- Removed `xlsx` from project dependencies.
- Added `exceljs`.
- Migrated server-side imports to `exceljs`:
  - global template import
  - role-template import
  - project requirement import in `append` and `replace` modes
- Migrated matrix Excel export to `exceljs`.
- Kept upload hardening:
  - reject empty files
  - reject files above 5 MB
  - require `.xlsx` extension
  - validate ZIP/XLSX file signature before parsing
  - cap workbook shape to 2000 rows, 50 columns per row, and 10000 characters
    per cell

## Verification

- `npm run lint`: OK
- `npm run build`: OK
- Valid `.xlsx` project import generated with `exceljs`: OK
- Fake `.xlsx` upload: rejected before parsing
- `npm audit`: no remaining `xlsx` finding

## Remaining Audit Item

`npm audit` still reports a moderate `postcss` issue through the current Next.js
dependency chain. That is separate from Excel handling.
