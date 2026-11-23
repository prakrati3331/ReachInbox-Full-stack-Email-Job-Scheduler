import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
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

function toCsv(rows: ScheduledEmail[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = "recipient,subject,fromName,fromEmail,scheduledAt,sentAt,status,openedAt,clickedAt";
  const lines = rows.map((e) =>
    [
      e.recipient,
      e.subject,
      e.fromName,
      e.fromEmail,
      e.scheduledAt,
      e.sentAt ?? "",
      e.status,
      e.openedAt ?? "",
      e.clickedAt ?? "",
    ]
      .map(esc)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export default function Dashboard({ user, onUserChange, pushToast }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("scheduled");
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [clearing, setClearing] = useState(false);
  const seenFailed = useRef<Set<string> | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === "scheduled" ? await api.scheduled() : await api.sent();
      setEmails(res.emails);

      // Toast when new failures appear between polls (aggregated).
      const failedNow = res.emails.filter((e) => e.status === "failed");
      if (seenFailed.current === null) {
        seenFailed.current = new Set(failedNow.map((e) => e.id));
      } else {
        const fresh = failedNow.filter((e) => !seenFailed.current!.has(e.id));
        fresh.forEach((e) => seenFailed.current!.add(e.id));
        if (fresh.length > 0 && !firstLoad.current) {
          pushToast(`${fresh.length} ${t("failedBatchToast")}`, "err");
        }
      }
      firstLoad.current = false;
    } catch (e) {
      pushToast(e instanceof Error ? e.message : t("loadFailed"), "err");
    } finally {
      setLoading(false);
    }
  }, [tab, pushToast, t]);

  useEffect(() => {
    firstLoad.current = true;
    seenFailed.current = null;
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
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
      pushToast(t("searchFailed"), "err");
    } finally {
      setSearching(false);
    }
  };

  const removeEmail = async (email: ScheduledEmail) => {
    try {
      await api.deleteEmail(email.id);
      pushToast(t("deletedOk"));
      load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : t("deleteFailed"), "err");
    }
  };

  const clearSent = async () => {
    if (!window.confirm(t("clearSentConfirm"))) return;
    setClearing(true);
    try {
      const collect = async (status?: string) => {
        const ids: string[] = [];
        for (let page = 1; page <= 20; page++) {
          const res = await api.sent(page, status);
          ids.push(...res.emails.map((e) => e.id));
          if (page * 50 >= res.total || res.emails.length === 0) break;
        }
        return ids;
      };
      const unique = [...new Set([...(await collect()), ...(await collect("failed"))])];
      let deleted = 0;
      for (let i = 0; i < unique.length; i += 500) {
        const r = await api.deleteEmails(unique.slice(i, i + 500));
        deleted += r.deleted;
      }
      pushToast(`${deleted} ${t("deletedOk")}`);
      load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : t("deleteFailed"), "err");
    } finally {
      setClearing(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = tab === "scheduled" ? await api.scheduled(1) : await api.sent(1);
      const csv = toCsv(res.emails);
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `reachinbox-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      pushToast(t("loadFailed"), "err");
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
          <div className="flex gap-1 rounded-lg bg-slate-200/60 p-1 dark:bg-slate-800">
            {(["scheduled", "sent"] as Tab[]).map((t2) => (
              <button
                key={t2}
                onClick={() => {
                  setTab(t2);
                  setSearchResults(null);
                  setQuery("");
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                  tab === t2
                    ? "bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {t2 === "sent" ? t("tabSent") : t("tabScheduled")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder={t("searchPlaceholder")}
              className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              onClick={runSearch}
              disabled={searching}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {searching ? t("searching") : t("search")}
            </button>
            <button
              onClick={exportCsv}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t("exportCsv")}
            </button>
            {tab === "sent" && (
              <button
                onClick={clearSent}
                disabled={clearing}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:hover:bg-rose-950"
              >
                {clearing ? "…" : t("clearSent")}
              </button>
            )}
            <button
              onClick={() => setComposeOpen(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t("compose")}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {searchResults ? (
            <SearchResultsTable results={searchResults} />
          ) : (
            <EmailTable
              emails={emails}
              loading={loading}
              emptyMessage={tab === "scheduled" ? t("emptyScheduled") : t("emptySent")}
              onDelete={removeEmail}
            />
          )}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          {t("bullBoard")}{" "}
          <a
            href="/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
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
  const { t } = useI18n();
  if (results.length === 0) {
    return <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">{t("noMatches")}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-950">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colEmail")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colSubject")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colScheduled")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colSent")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colStatus")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {results.map((r) => (
            <tr key={r.emailId} className="hover:bg-slate-50 dark:hover:bg-slate-950">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{r.recipient}</td>
              <td className="max-w-xs truncate px-4 py-3 text-slate-600 dark:text-slate-300">{r.subject}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                {new Date(r.scheduledAt).toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
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
