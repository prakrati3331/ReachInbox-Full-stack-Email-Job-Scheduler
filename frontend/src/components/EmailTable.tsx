import type { ScheduledEmail } from "../types";

interface Props {
  emails: ScheduledEmail[];
  loading: boolean;
  emptyMessage: string;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-sky-50 text-sky-700",
  rate_limited: "bg-amber-50 text-amber-700",
  sending: "bg-indigo-50 text-indigo-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default function EmailTable({ emails, loading, emptyMessage }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
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
          {emails.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{e.recipient}</td>
              <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={e.subject}>
                {e.subject}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmt(e.scheduledAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmt(e.sentAt)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={e.status} />
                {e.status === "failed" && e.failReason && (
                  <div className="mt-1 max-w-[200px] truncate text-xs text-rose-500" title={e.failReason}>
                    {e.failReason}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
