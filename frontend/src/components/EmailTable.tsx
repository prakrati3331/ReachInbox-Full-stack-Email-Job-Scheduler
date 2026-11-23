import type { ScheduledEmail } from "../types";
import { useI18n } from "../i18n";

interface Props {
  emails: ScheduledEmail[];
  loading: boolean;
  emptyMessage: string;
  onDelete?: (email: ScheduledEmail) => void;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  rate_limited: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  sending: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {t(`st_${status}`)}
    </span>
  );
}

const PENDING = ["scheduled", "rate_limited", "sending"];

export default function EmailTable({ emails, loading, emptyMessage, onDelete }: Props) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700" />
      </div>
    );
  }
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colEmail")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colSubject")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colScheduled")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colSent")}</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">{t("colStatus")}</th>
            {onDelete && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
          {emails.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{e.recipient}</td>
              <td className="max-w-xs truncate px-4 py-3 text-slate-600 dark:text-slate-300" title={e.subject}>
                {e.subject}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{fmt(e.scheduledAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{fmt(e.sentAt)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={e.status} />
                {e.openedAt && (
                  <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400" title={`Opened ${fmt(e.openedAt)}`}>
                    {t("opened")}
                  </div>
                )}
                {e.clickedAt && (
                  <div className="text-xs text-indigo-600 dark:text-indigo-400" title={`Clicked ${fmt(e.clickedAt)}`}>
                    {t("clicked")}
                  </div>
                )}
                {e.status === "failed" && e.failReason && (
                  <div className="mt-1 max-w-[200px] truncate text-xs text-rose-500" title={e.failReason}>
                    {e.failReason}
                  </div>
                )}
              </td>
              {onDelete && (
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(e)}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-700"
                  >
                    {PENDING.includes(e.status) ? t("cancel") : t("delete")}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
