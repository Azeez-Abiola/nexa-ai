import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Allow natural touch scrolling
document.addEventListener("touchmove", (e) => {
  // Allow scrolling - don't prevent default
  return true;
}, { passive: true });

createRoot(document.getElementById("root")!).render(<App />);
