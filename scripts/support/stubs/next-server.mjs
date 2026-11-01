// NextResponse as plain Responses, and after() queued for the test to run.
const state = (globalThis.__test ??= { cookies: new Map(), headers: {}, after: [] });

export const NextResponse = {
  json: (body, init) => Response.json(body, init),
  redirect: (url) => Response.redirect(url, 307),
};

export function after(callback) {
  state.after.push(callback);
}
