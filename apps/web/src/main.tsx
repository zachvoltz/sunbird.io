import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { UiPrefsProvider } from "@/context/UiPrefsContext";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UiPrefsProvider>
          <App />
        </UiPrefsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
