import { useEffect, useState } from "react";
import { api } from "../api";
import type { SlackChannel, SlackStatus, User } from "../types";

interface Props {
  user: User;
  onLogout: () => Promise<void>;
  pushToast: (msg: string, kind?: "ok" | "err") => void;
}

export default function Header({ user, onLogout, pushToast }: Props) {
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [busy, setBusy] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSlack = () => {
    window.location.href = "/api/slack/connect";
  };

  const disconnectSlack = async () => {
    setBusy(true);
    try {
      await api.slackDisconnect();
      pushToast("Slack disconnected");
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

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-base font-bold text-white">
          O
        </div>
        <span className="text-lg font-bold text-slate-900">Outbox</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Slack integration */}
        {slack?.configured && slack.connected ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Slack: {slack.connection?.teamName ?? "connected"}
            </span>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              value={slack.connection?.channelId ?? ""}
              onChange={(e) => pickChannel(e.target.value)}
            >
              <option value="">Pick channel…</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
            <button
              onClick={disconnectSlack}
              disabled={busy}
              className="text-xs text-slate-500 hover:text-rose-600"
            >
              Disconnect
            </button>
          </div>
        ) : slack?.configured ? (
          <button
            onClick={connectSlack}
            className="rounded-lg bg-[#4A154B] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Connect Slack
          </button>
        ) : null}

        {/* User */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
