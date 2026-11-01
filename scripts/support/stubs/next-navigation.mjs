// redirect() as Next does it: it throws, so nothing after it runs. The test
// reads the target from the error.
export class RedirectError extends Error {
  constructor(url) {
    super(`redirect ${url}`);
    this.url = url;
  }
}

export function redirect(url) {
  throw new RedirectError(url);
}

export function notFound() {
  throw new RedirectError('not-found');
}
