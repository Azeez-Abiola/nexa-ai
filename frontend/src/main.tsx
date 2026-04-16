import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import { App } from "./App";
import "./styles.css";

axios.defaults.baseURL = import.meta.env.VITE_API_URL || "";

// Prevent all drag and pan interactions
document.addEventListener("dragstart", (e) => e.preventDefault(), false);
document.addEventListener("dragover", (e) => e.preventDefault(), false);
document.addEventListener("drop", (e) => e.preventDefault(), false);
// Block touch-pan only inside the fixed-layout chat shell, where the outer container is meant
// to stay pinned. Everywhere else (landing, marketing pages, admin dashboards, auth screens)
// must scroll normally — this used to be an allow-list and silently broke every new surface.
document.addEventListener("touchmove", (e) => {
  const target = e.target as Element | null;
  if (!target || !target.closest) return;
  const insideChatShell = target.closest(".ufl-root");
  const insideScrollRegion =
    target.closest(".chat-messages") ||
    target.closest(".sidebar-conversations") ||
    target.closest(".user-chat-profile-page") ||
    target.closest(".messages-container-v2") ||
    target.closest("[data-allow-scroll]");
  if (insideChatShell && !insideScrollRegion) {
    e.preventDefault();
  }
}, { passive: false });
document.addEventListener("wheel", (e) => {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });

// Prevent pointer-based panning
let isPointerDown = false;
document.addEventListener("pointerdown", () => { isPointerDown = true; }, false);
document.addEventListener("pointerup", () => { isPointerDown = false; }, false);
document.addEventListener("pointermove", (e) => {
  if (isPointerDown && e.isPrimary) {
    e.preventDefault();
  }
}, { passive: false });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);


