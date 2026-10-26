import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-700.css";
import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <Suspense
        fallback={
          <div className="route-loader" role="status">
            Cargando…
          </div>
        }
      >
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  </StrictMode>,
);
