import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { UiPrefsProvider } from "@/context/UiPrefsContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { installGlobalErrorHandlers } from "@/lib/reportError";
import { App } from "./App";
import "./styles.css";

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <UiPrefsProvider>
            <App />
          </UiPrefsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
