# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fexios is a lightweight (~6KB gzipped) fetch-based HTTP client library with an axios-like API, targeting both browser and Node.js. Zero runtime dependencies — uses Web APIs only. Requires Node 16.15.0+ or modern browsers.

## Commands

```bash
# Build (parallel: unbuild for ESM/CJS + vite for UMD)
npm run build

# Run all tests
npm run test

# Run a single test file
npx vitest run ./test/core.spec.ts

# Run tests matching a pattern
npx vitest run -t "hook"

# Clean build output
npm run clean

# Preview test coverage report
npm run review
```

## Build Outputs

- `dist/` — ESM (`.mjs`) and CJS (`.cjs`) via unbuild, with `.d.mts` declarations
- `lib/` — UMD bundle via vite
- Version is injected at build time via `import.meta.env.__VERSION__`

## Architecture

### Core Request Lifecycle

The library is built around a **hook-based lifecycle** that processes requests through sequential stages:

```
beforeInit → beforeRequest → afterBodyTransformed → beforeActualFetch → afterRawResponse → afterResponse
```

Each hook can return: `void/context` (proceed), `false` (abort), `Response` (short-circuit fetch), `FexiosResponse` (short-circuit with parsed response), or `FexiosFinalContext` (complete context replacement).

### Context Architecture

Request processing uses a three-layer context structure (`FexiosContext`):
- `ctx.request` — URL, method, headers, query, body, rawRequest
- `ctx.runtime` — abortController, customEnv (for passing data between hooks)
- `ctx.response` — parsed FexiosResponse (available after `afterRawResponse`)

Legacy v5 flat aliases (`ctx.url`, `ctx.headers`, etc.) exist on FexiosContext and delegate to `ctx.request.*` / `ctx.runtime.*` via property descriptors.

### CallableInstance Pattern

`Fexios` extends `CallableInstance`, making instances directly callable: `fexios(url, options)` calls `this.request()`. Method shortcuts (`get`, `post`, etc.) are defined via `Reflect.defineProperty`.

### Key Source Files

- `src/fexios.ts` — Main class: thin orchestration shell (~470 lines), delegates to internals
- `src/internals/context.ts` — Legacy alias attachment and context finalization
- `src/internals/hooks.ts` — Hook execution engine, short-circuit resolution, duck-type checks
- `src/internals/request-helpers.ts` — URL resolution, body transform, query merge, defaults application
- `src/types.ts` — All type definitions and interfaces
- `src/models/response.ts` — `FexiosResponse` wrapper with auto-parsed body
- `src/models/errors.ts` — Error classes and error code enum
- `src/models/header-builder.ts` — Static utilities for Headers manipulation
- `src/models/query-builder.ts` — Static utilities for URLSearchParams

### Plugin System

Plugins implement `FexiosPlugin` interface (`name`, `install`, optional `uninstall`). Built-in plugins under `src/plugins/`: cookie-jar, sse, ws, post-form. WebSocket and SSE were moved out of core into plugins in v6.

### Package Exports

Multiple entry points via `exports` field in package.json:
- `fexios` — full library
- `fexios/core` — Fexios class only
- `fexios/types` — type definitions
- `fexios/models` — response, errors, header/query builders
- `fexios/utils` — callable-instance, deep-merge, clone, isPlainObject
- `fexios/plugins` — all plugins

## Testing

- Framework: Vitest (configured in `vite.config.ts` under `test` key)
- Tests are in `test/` directory, mock fetch in `test/mockFetch.ts`
- Coverage enabled via `@vitest/coverage-v8`, reports to `.test_reports/`
- Test timeout: 10 seconds
- Path alias: `@/*` maps to `./src/*`

## Release

Auto-publish via GitHub Actions (`.github/workflows/npm-publish.yml`):

1. Bump version in `package.json`
2. Commit: `chore: bump version to x.y.z`
3. Create tag: `git tag x.y.z` — **no `v` prefix**
4. Push: `git push && git push --tags`

GitHub Actions will validate that the tag matches `package.json` version, then build, test, and publish to npm with provenance. Manual trigger via `workflow_dispatch` is also supported.

## Code Conventions

- Code comments in English
- Uses `@/` path alias for src imports in source code
- Static utility classes use namespace pattern (e.g., `FexiosHeaderBuilder.from()`)
- Internal markers use Symbols (e.g., `FINAL_SYMBOL` for context finalization)
- Query/header merge priority: request params > URL params > defaults
