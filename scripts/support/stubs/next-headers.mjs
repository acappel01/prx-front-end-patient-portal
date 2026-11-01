// A cookie jar and request headers the test sets (globalThis.__test).
const state = (globalThis.__test ??= { cookies: new Map(), headers: {}, after: [] });

export async function cookies() {
  return {
    get: (name) => (state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined),
    set: (name, value, options) => {
      state.cookies.set(name, value);
      (state.cookieOptions ??= new Map()).set(name, options);
    },
    delete: (name) => state.cookies.delete(name),
  };
}

export async function headers() {
  return new Headers(state.headers);
}
