import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ERR_CONNECTION_LOST } from "home-assistant-js-websocket";
import "./index.css";
import App from "./App";

// Suppress unhandled rejections from fire-and-forget callService() calls
// when the WS briefly disconnects. The library reconnects automatically;
// letting these bubble as unhandled can destabilise iOS WKWebView.
window.addEventListener("unhandledrejection", (e) => {
  if (e.reason === ERR_CONNECTION_LOST) e.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
