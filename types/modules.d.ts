/// <reference types="next" />
// Next's own globals (its `next` option on fetch, and friends), as the
// next-env.d.ts of a TypeScript project would add them.

// Modules the type check cannot see into: the server-only guard (a bundler
// marker with no exports) and stylesheets (compiled by Next's Sass loader).
declare module 'server-only';
declare module '*.scss';
