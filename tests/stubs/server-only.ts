/**
 * Test-only stub for the `server-only` package (aliased in `vitest.config.ts`).
 *
 * The real `server-only` package resolves to a module that THROWS on import in any
 * non-React-Server-Component graph — its whole job is to fail the build if a
 * server-only module is pulled into a client bundle. Vitest runs in a plain `node`
 * environment and does NOT apply the `react-server` export condition, so importing
 * a module that does `import 'server-only'` (e.g. `get-portfolio-owner.ts`) would
 * hit the client-build entry and throw "This module cannot be imported from a
 * Client Component module."
 *
 * This empty stub is the standard, documented escape hatch: aliasing `server-only`
 * to a no-op lets integration tests import server modules to assert their RUNTIME
 * behavior (RLS, ownership, visibility) without the import-time guard firing. It
 * does NOT weaken the production guard — the alias exists only inside the Vitest
 * resolver. The FND-05 secret-leak guard (a separate `.next/static` grep) still
 * enforces server-only isolation in the real build.
 */
export {};
