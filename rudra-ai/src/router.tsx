import { Route, Router, useLocation, useNavigate } from "@solidjs/router";
import { type JSX, onMount } from "solid-js";
import { adapter } from "./lib/backend";
import { AppShell } from "./components/layout/AppShell";
import { Connect } from "./pages/Connect";
import { Settings } from "./pages/Settings";
import { Workspace } from "./pages/Workspace";

function ShellLayout(props: { children?: JSX.Element }) {
  const navigate = useNavigate();
  const location = useLocation();
  onMount(() => {
    if (!adapter.isConnected() && location.pathname !== "/connect") {
      navigate("/connect", { replace: true });
    }
  });
  return <AppShell>{props.children}</AppShell>;
}

/** Client-side routes. Same router runs in Tauri's webview later. */
export function AppRouter() {
  return (
    <Router>
      <Route path="/connect" component={Connect} />
      <Route path="/" component={ShellLayout}>
        <Route path="/" component={Workspace} />
        <Route path="/s/:id" component={Workspace} />
        <Route path="/settings" component={Settings} />
      </Route>
    </Router>
  );
}
