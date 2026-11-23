import { useCallback, useEffect, useState } from "react";
import { api, googleLoginUrl } from "./api";
import type { User } from "./types";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Toast from "./components/Toast";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);

  const pushToast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onLogout = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, [loadMe]);

  // Handle OAuth redirect query params (?slack=connected / errors / auth_error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slack = params.get("slack");
    const slackErr = params.get("slack_error");
    const authErr = params.get("auth_error");
    if (slack === "connected") pushToast("Slack connected");
    if (slackErr) pushToast(`Slack connection failed: ${slackErr}`, "err");
    if (authErr) pushToast(`Login failed: ${authErr}`, "err");
    if (slack || slackErr || authErr) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [pushToast]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <Login onDevLogin={async (email, name) => {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, name }),
      });
      if (res.ok) await loadMe();
      else pushToast("Dev login failed — is ALLOW_DEV_LOGIN=true on the backend?", "err");
    }} googleUrl={googleLoginUrl()} />;
  }

  return (
    <>
      <Dashboard user={user} onUserChange={setUser} pushToast={pushToast} />
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} msg={t.msg} kind={t.kind} />
        ))}
      </div>
    </>
  );
}
