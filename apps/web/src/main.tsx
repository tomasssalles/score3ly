import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./themes.css";
import "./styles.css";
import { App } from "./App";
import { startDesktopWindow } from "./host";
import { startThemes } from "./themes";

startThemes();
startDesktopWindow();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
