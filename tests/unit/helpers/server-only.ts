/**
 * Stub for the `server-only` marker package.
 *
 * The real module throws on import to stop server code being bundled into a
 * client component. Under vitest there is no client bundle, so importing it
 * would fail every test of a server module for a reason that does not apply.
 */
export {};
