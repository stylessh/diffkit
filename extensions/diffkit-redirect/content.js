(async function runRedirect() {
  const ignoreReferrers = [
    "https://github.com/",
    "https://diff-kit.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  if (
    ignoreReferrers.some((referrer) => document.referrer.startsWith(referrer))
  ) {
    return;
  }

  const shared = globalThis.DiffKitRedirect;
  if (!shared) {
    return;
  }

  try {
    const config = await shared.getConfig();
    if (!config.enabled) {
      return;
    }

    const redirect = shared.findRedirect(window.location.href, config.rules);
    if (!redirect) {
      return;
    }

    window.location.replace(redirect.targetUrl);
  } catch (error) {
    console.error("DiffKit: failed to evaluate redirect.", error);
  }
})();
