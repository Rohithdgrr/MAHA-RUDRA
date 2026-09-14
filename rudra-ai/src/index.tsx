/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";
import { initShiki } from "./lib/utils/shiki";
import { devMode } from "./lib/utils/devmode";
import { setVerbose } from "./lib/utils/logger";

const root = document.getElementById("root");

if (root) {
  render(() => <App />, root);
}

// Grammars load off the critical path; code cards fall back until ready.
void initShiki();

// Restore persisted developer verbosity before anything logs.
if (devMode()) setVerbose(true);
