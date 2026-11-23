import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n, LANGS } from "../i18n";
import { isDark, toggleTheme } from "../theme";
import type { SlackChannel, SlackStatus, User } from "../types";

interface Props {
  user: User;
  onLogout: () => Promise<void>;
  pushToast: (msg: string, kind?: "ok" | "err") => void;
}

interface Stats {
  hourly: { used: number; limit: number; windowEndsAt: number };
}

export default function Header({ user, onLogout, pushToast }: Props) {
  const { t, lang, setLang } = useI18n();
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(isDark());
  const [stats, setStats] = useState<Stats | null>(null);

  const refresh = async () => {
    try {
      const s = await api.slackStatus();
      setSlack(s);
      if (s.connected) {
        const c = await api.slackChannels();
        setChannels(c.channels);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refresh();
    const loadStats = () => api.stats().then(setStats).catch(() => {});
    loadStats();
    const t1 = setInterval(loadStats, 15000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => clearInterval(t1);
  }, []);

  const connectSlack = () => {
    window.location.href = "/api/slack/connect";
  };

  const disconnectSlack = async () => {
    setBusy(true);
    try {
      await api.slackDisconnect();
      pushToast(t("slackConnected") + " disconnected");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const pickChannel = async (channelId: string) => {
    try {
      await api.slackSetChannel(channelId);
      pushToast("Notification channel updated");
      await refresh();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Failed", "err");
    }
  };

  const pct = stats ? Math.min(100, Math.round((stats.hourly.used / Math.max(1, stats.hourly.limit)) * 100)) : 0;

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-base font-bold text-white">
          R
        </div>
        <span className="text-lg font-bold text-slate-900 dark:text-white">ReachInbox</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Hourly rate-limit usage */}
        {stats && (
          <div
            className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 md:flex dark:bg-slate-800 dark:text-slate-300"
            title={`${stats.hourly.used} / ${stats.hourly.limit} emails this hour`}
          >
            <span>⏱ {stats.hourly.used}/{stats.hourly.limit}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-300 dark:bg-slate-600">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Language */}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as typeof lang)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          title="Language"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        {/* Dark mode */}
        <button
          onClick={() => setDark(toggleTheme())}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Toggle dark mode"
        >
          {dark ? "☀️" : "🌙"}
        </button>

        {/* Slack integration */}
        {slack?.configured && slack.connected ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {t("slackConnected")}: {slack.connection?.teamName ?? "connected"}
            </span>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              value={slack.connection?.channelId ?? ""}
              onChange={(e) => pickChannel(e.target.value)}
            >
              <option value="">{t("pickChannel")}</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
            <button onClick={disconnectSlack} disabled={busy} className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400">
              {t("disconnect")}
            </button>
          </div>
        ) : slack?.configured ? (
          <button
            onClick={connectSlack}
            className="rounded-lg bg-[#4A154B] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {t("connectSlack")}
          </button>
        ) : null}

        {/* User */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-800">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-slate-900 dark:text-white">{user.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
