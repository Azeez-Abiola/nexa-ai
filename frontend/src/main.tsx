import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

// Prevent all drag and pan interactions
document.addEventListener("dragstart", (e) => e.preventDefault(), false);
document.addEventListener("dragover", (e) => e.preventDefault(), false);
document.addEventListener("drop", (e) => e.preventDefault(), false);
document.addEventListener("touchmove", (e) => {
  // Allow free scrolling in chat messages and sidebar
  if (e.target.closest(".chat-messages") || e.target.closest(".sidebar-conversations")) return;
  e.preventDefault();
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


