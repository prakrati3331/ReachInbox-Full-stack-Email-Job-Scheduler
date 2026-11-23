import { useRef, useState } from "react";
import { api } from "../api";

interface Props {
  onClose: () => void;
  onScheduled: (count: number) => void;
  pushToast: (msg: string, kind?: "ok" | "err") => void;
}

export default function ComposeModal({ onClose, onScheduled, pushToast }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(Date.now() + 60_000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [delaySec, setDelaySec] = useState("2");
  const [hourlyLimit, setHourlyLimit] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const res = await api.parseLeads(file);
      setEmails(res.emails);
      setFileName(file.name);
      pushToast(`Detected ${res.count} email address${res.count === 1 ? "" : "es"}`);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Failed to parse file", "err");
    } finally {
      setParsing(false);
    }
  };

  const submit = async () => {
    if (emails.length === 0) {
      pushToast("Upload a CSV/TXT file with email leads first", "err");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      pushToast("Subject and body are required", "err");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.schedule({
        recipients: emails,
        subject,
        body,
        startAt: new Date(startAt).toISOString(),
        delayBetweenMs: Math.max(0, Number(delaySec) || 0) * 1000,
        hourlyLimit: Number(hourlyLimit) > 0 ? Number(hourlyLimit) : undefined,
      });
      pushToast(`Scheduled ${res.scheduled} email${res.scheduled === 1 ? "" : "s"}`);
      onScheduled(res.scheduled);
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Scheduling failed", "err");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Compose New Email</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Leads (CSV / TXT)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
            >
              {parsing
                ? "Parsing…"
                : fileName
                  ? `${fileName} — ${emails.length} emails detected`
                  : "Click to upload CSV or TXT file"}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your email subject"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Email body…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start time</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Delay between (sec)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={delaySec}
                onChange={(e) => setDelaySec(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hourly limit</label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={submit}
            disabled={submitting || emails.length === 0}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Scheduling…" : `Schedule ${emails.length || ""} email${emails.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
