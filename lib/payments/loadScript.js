/**
 * Loads a gateway's browser SDK once, resolving when its global appears.
 *
 * `attributes` are set on the script tag before it loads. Collect.js reads its
 * tokenization key from `data-tokenization-key` at load time, so a tag already
 * on the page with a DIFFERENT key (routing moved to another NMI account) is
 * removed with its global and loaded again. Otherwise the new account's form
 * would tokenise against the old account and the charge would fail.
 */
export function loadScript(src, globalName, attributes = {}) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window."));
  }

  const existing = document.querySelector(`script[src="${src}"]`);
  const stale =
    existing &&
    Object.entries(attributes).some(([name, value]) => existing.getAttribute(name) !== String(value));

  if (stale) {
    existing.remove();
    delete window[globalName];
  } else if (window[globalName]) {
    return Promise.resolve(window[globalName]);
  }

  return new Promise((resolve, reject) => {
    const settle = () =>
      window[globalName]
        ? resolve(window[globalName])
        : reject(new Error("The payment library loaded but did not initialise."));

    const fail = () => reject(new Error("Could not load the payment library."));

    if (existing && !stale) {
      existing.addEventListener("load", settle, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, String(value)));
    script.addEventListener("load", settle, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  });
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The page's own input look, read from a mounted element, for gateways whose
 * fields live in their own iframe and cannot see our CSS. Read at mount, so a
 * theme change in the admin reaches the card fields without a rebuild.
 */
export function hostedFieldStyle(element) {
  const fallback = {
    color: "#1a1a1a",
    placeholder: "rgba(102, 112, 133, 0.8)",
    error: "#c0392b",
    fontFamily: "system-ui, sans-serif",
    fontSize: "16px",
  };

  if (typeof window === "undefined" || !element) {
    return fallback;
  }

  const computed = window.getComputedStyle(element);
  const error = window.getComputedStyle(document.documentElement).getPropertyValue("--prx-urgent").trim();

  return {
    ...fallback,
    color: computed.color || fallback.color,
    fontFamily: computed.fontFamily || fallback.fontFamily,
    error: error || fallback.error,
  };
}
