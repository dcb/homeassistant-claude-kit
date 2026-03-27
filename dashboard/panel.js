// Custom panel element that embeds the React dashboard in an iframe.
// Uses Vite's build manifest to resolve the current asset hashes,
// then constructs the page via srcdoc so we never serve a stale
// index.html from the browser cache.
//
// IMPORTANT: Uses iframe.srcdoc (not blob: URLs) because blob: iframes
// get a null/opaque origin on iOS Safari/WKWebView, which blocks
// window.top access and prevents inheriting HA's WebSocket connection.
class CustomDashboardPanel extends HTMLElement {
  connectedCallback() {
    const base = "/local/custom-dashboard";

    // Style the host element
    this.style.cssText = "display:block;width:100%;height:100%;";

    fetch(`${base}/.vite/manifest.json?_=${Date.now()}`)
      .then((r) => r.json())
      .then((manifest) => {
        const entry = manifest["index.html"];
        if (!entry?.file) throw new Error("no entry in manifest");

        const js = `${base}/${entry.file}`;
        const cssLinks = (entry.css || [])
          .map((c) => `<link rel="stylesheet" href="${base}/${c}">`)
          .join("\n    ");

        const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#0f0f14">
    ${cssLinks}
</head>
<body>
    <div id="root"></div>
    <script type="module" src="${js}"><\/script>
</body>
</html>`;

        this._appendIframe(html);
      })
      .catch(() => {
        // Fallback: load index.html directly (cache-busted with timestamp)
        const iframe = document.createElement("iframe");
        iframe.src = `${base}/index.html?v=${Date.now()}`;
        iframe.style.cssText = "border:0;width:100%;height:100%;display:block;";
        this.appendChild(iframe);
        this._forwardVisibility(iframe);
      });
  }

  _appendIframe(srcdocHtml) {
    const iframe = document.createElement("iframe");
    iframe.srcdoc = srcdocHtml;
    iframe.style.cssText = "border:0;width:100%;height:100%;display:block;";
    this.appendChild(iframe);
    this._forwardVisibility(iframe);
  }

  // Forward visibilitychange from the parent document into the iframe.
  // iOS WKWebView fires visibilitychange on the top-level document but
  // NOT inside iframes — @hakit/core's suspend/resume depends on it.
  _forwardVisibility(iframe) {
    document.addEventListener("visibilitychange", () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.dispatchEvent(new Event("visibilitychange"));
        }
      } catch { /* cross-origin — ignore */ }
    });
  }
}
customElements.define("custom-dashboard-panel", CustomDashboardPanel);
