import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "jotai";
import App from "./App";
import { applyLayoutVariables } from "./layout";
import { queryClient } from "./queries";
import "./styles.css";
import "mapbox-gl/dist/mapbox-gl.css";

// A scrolling panel reserves its gutter with `scrollbar-gutter`, and the panel-scroll utility
// takes that width back off the end padding so both sides read as one inset. The probe has to
// declare the same gutter and scrollbar width, since the reserved gutter is what takes the space
// and it differs from what an overlay scrollbar would occupy.
const probe = document.createElement("div");
probe.style.cssText =
  "position:absolute;top:-9999px;width:100px;height:100px;overflow-y:auto;scrollbar-gutter:stable;scrollbar-width:thin";
document.body.append(probe);
document.documentElement.style.setProperty(
  "--scrollbar-width",
  `${probe.offsetWidth - probe.clientWidth}px`,
);
probe.remove();
applyLayoutVariables(document.documentElement);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider>
        <App />
      </Provider>
    </QueryClientProvider>
  </StrictMode>,
);
