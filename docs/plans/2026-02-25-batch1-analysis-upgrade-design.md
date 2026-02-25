# Batch 1: Analysis Result Experience Upgrade + Turso Migration

**Date:** 2026-02-25
**Status:** Approved

## Background

DataChat is an AI-powered data analysis platform using Next.js 15, DuckDB WASM, ECharts, and DeepSeek API. The current architecture runs SQL queries in the browser via DuckDB WASM, which causes slow loading (~10MB WASM bundle) and high memory usage.

## Goals

1. Replace DuckDB WASM with Turso (cloud SQLite) to eliminate browser performance issues
2. Add data table preview to analysis results
3. Add SQL editing and re-execution capability
4. Allow users to switch chart types on existing results

## Architecture Change

### Before
```
User question → LLM generates SQL → Browser DuckDB WASM executes → Frontend renders
```

### After
```
User question → LLM generates SQL → Server-side Turso executes → Frontend renders
```

### Key changes
- Remove DuckDB WASM dependency (~10MB bundle eliminated)
- Migrate sample data from Parquet files to Turso pre-populated tables
- Move query execution from client-side to server-side API route
- Change SQL dialect in LLM prompt from DuckDB to SQLite
- Custom file upload: client parses → server receives → writes to Turso temp tables

## Feature 0: Turso Migration

### Database Setup
- Create Turso database via CLI or dashboard
- Pre-populate 3 sample datasets (ecommerce, user-behavior, marketing) as SQLite tables
- Update dataset generation script to output SQL INSERT statements

### API Changes
- New `/api/query` endpoint: accepts raw SQL, executes against Turso, returns results
- Update `/api/analyze` to execute SQL server-side via Turso instead of returning SQL for client execution
- API response now includes `queryResult` directly

### Client Changes
- Remove `use-duckdb` hook, `duckdb.ts`, `duckdb-preloader.tsx`
- Remove DuckDB WASM and Parquet-related dependencies
- Analysis page no longer needs to initialize DuckDB or load Parquet files
- Custom upload flow: parse file client-side → POST data to new `/api/upload` endpoint → server creates Turso temp table

### Custom Upload Multi-tenancy
- Use session ID as table prefix: `sess_{sessionId}_{tableName}`
- Temp tables auto-expire (cleanup via cron or Turso TTL)

### LLM Prompt
- Change SQL dialect from DuckDB to SQLite
- Update syntax notes (e.g., date functions change from `DATE_TRUNC` to `strftime`)

## Feature 1: Data Table Preview

### Component: `DataTable`
- Location: `src/components/analyze/data-table.tsx`
- Receives `QueryResult` (columns + rows)
- Default: **collapsed**, click to expand
- Pagination: 10 rows per page, max 100 rows loaded
- Number columns right-aligned
- Horizontal scroll for many columns
- Copy as CSV button
- Uses shadcn/ui Table component

### Integration in AnalysisCard
- Positioned between chart and insight sections
- Toggle button: "View data (N rows)" with expand/collapse icon

## Feature 2: SQL Edit & Re-execute

### Interaction Flow
1. User clicks "Edit" button in SQL section
2. `<pre>` transforms to `<textarea>` with monospace font
3. "Cancel" and "Execute" buttons appear
4. On execute: POST edited SQL to `/api/query` → update chart + data table
5. On success: replace current card's queryResult and re-render
6. On failure: show error inline, preserve original results

### API
- Uses the new `/api/query` endpoint
- Access code validation still required
- Rate limiting applies

## Feature 3: Chart Type Switcher

### Component: `ChartTypeSwitcher`
- Location: integrated into `ChartRenderer` or as sibling component
- Dropdown menu (shadcn/ui DropdownMenu) in chart area top-right
- Available types: Line, Bar, Pie, Scatter, Heatmap, Funnel
- LLM-recommended type shown as default
- Switching is pure frontend: same queryResult data, only chartConfig.type changes
- Incompatible types greyed out with tooltip (e.g., scatter needs 2+ numeric columns)

### Logic
- Maintain local state `overrideChartType` in AnalysisCard
- Pass to ChartRenderer which uses override if set, otherwise original config
- Reset override when SQL is re-executed

## Layout Order (top to bottom in AnalysisCard)

1. User question header
2. Chart (with chart type switcher dropdown, top-right)
3. Data table (collapsed by default)
4. Insight text
5. SQL section (expandable, editable, executable)

## Files to Change

### New files
- `src/components/analyze/data-table.tsx`
- `src/app/api/query/route.ts`
- `src/app/api/upload/route.ts`
- `src/lib/turso.ts` (Turso client initialization)
- `scripts/seed-turso.ts` (seed sample data)

### Modified files
- `src/components/analyze/analysis-card.tsx` (integrate all 3 features)
- `src/components/analyze/chart-renderer.tsx` (accept chart type override)
- `src/app/api/analyze/route.ts` (execute SQL via Turso, return queryResult)
- `src/app/analyze/[datasetId]/page.tsx` (remove DuckDB init, simplify data loading)
- `src/app/analyze/custom/page.tsx` (upload flow → server-side)
- `src/lib/llm-prompt.ts` (DuckDB → SQLite dialect)
- `src/types/index.ts` (add new types if needed)
- `package.json` (add @libsql/client, remove duckdb-wasm)

### Deleted files
- `src/hooks/use-duckdb.ts`
- `src/lib/duckdb.ts`
- `src/components/duckdb-preloader.tsx`

## Out of Scope (future batches)
- Export reports (PDF/PNG/CSV)
- Analysis history persistence
- Smart question recommendations
- Multi-step complex analysis
- Deep data insights
- Prompt optimization
