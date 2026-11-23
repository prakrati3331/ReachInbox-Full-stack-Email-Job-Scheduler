import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { ScheduledEmail, SearchResult, User } from "../types";
import Header from "./Header";
import EmailTable, { StatusBadge } from "./EmailTable";
import ComposeModal from "./ComposeModal";

type Tab = "scheduled" | "sent";

interface Props {
  user: User;
  onUserChange: (u: User) => void;
  pushToast: (msg: string, kind?: "ok" | "err") => void;
}

export default function Dashboard({ user, onUserChange, pushToast }: Props) {
  const [tab, setTab] = useState<Tab>("scheduled");
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === "scheduled" ? await api.scheduled() : await api.sent();
      setEmails(res.emails);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Failed to load", "err");
    } finally {
      setLoading(false);
    }
  }, [tab, pushToast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // light polling for live-ish updates
    return () => clearInterval(t);
  }, [load]);

  const runSearch = async () => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const { results } = await api.search(query);
      setSearchResults(results);
    } catch {
      pushToast("Search failed", "err");
    } finally {
      setSearching(false);
    }
  };

  const logout = async () => {
    await api.logout();
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} onLogout={logout} pushToast={pushToast} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-200/60 p-1">
            {(["scheduled", "sent"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setSearchResults(null);
                  setQuery("");
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                  tab === t ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "sent" ? "Sent Emails" : "Scheduled Emails"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search emails (Elasticsearch)…"
              className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={runSearch}
              disabled={searching}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {searching ? "…" : "Search"}
            </button>
            <button
              onClick={() => setComposeOpen(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              + Compose New Email
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {searchResults ? (
            <SearchResultsTable results={searchResults} />
          ) : (
            <EmailTable
              emails={emails}
              loading={loading}
              emptyMessage={
                tab === "scheduled"
                  ? "No scheduled emails yet — compose one to get started."
                  : "No sent emails yet."
              }
            />
          )}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Live queue dashboard:{" "}
          <a
            href="/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline"
          >
            Bull Board (/admin/queues)
          </a>
        </p>
      </main>

      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onScheduled={() => load()}
          pushToast={pushToast}
          webhookUrl={user.webhookUrl ?? null}
        />
      )}
    </div>
  );
}

function SearchResultsTable({ results }: { results: SearchResult[] }) {
  if (results.length === 0) {
    return <div className="py-16 text-center text-sm text-slate-400">No matches found.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Email</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Subject</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Scheduled</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Sent</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {results.map((r) => (
            <tr key={r.emailId} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{r.recipient}</td>
              <td className="max-w-xs truncate px-4 py-3 text-slate-600">{r.subject}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {new Date(r.scheduledAt).toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
