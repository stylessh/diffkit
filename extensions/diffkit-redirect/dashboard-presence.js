/**
 * Runs on DiffKit web app origins so the site can detect the extension via DOM
 * (`data-diffkit-extension` on <html>). Content scripts cannot share `window`
 * with the page, but DOM attributes are visible to the app.
 *
 * Guard: Firefox may inject content scripts beyond the manifest `matches` when
 * the user grants broader host permissions, so we verify the origin explicitly.
 */
(function markDiffKitExtensionPresent() {
  try {
    const origin = location.origin;
    if (
      origin === "https://diff-kit.com" ||
      origin === "http://localhost:3000" ||
      origin === "http://127.0.0.1:3000"
    ) {
      document.documentElement.dataset.diffkitExtension = "1";
    }
  } catch {
    // ignore
  }
})();
