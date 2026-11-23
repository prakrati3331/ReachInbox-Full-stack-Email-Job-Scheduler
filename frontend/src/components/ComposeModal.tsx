import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
import type { Template } from "../types";

interface AttachmentDraft {
  filename: string;
  contentType: string;
  size: number;
  dataBase64: string;
}

interface Props {
  onClose: () => void;
  onScheduled: (count: number) => void;
  pushToast: (msg: string, kind?: "ok" | "err") => void;
  webhookUrl?: string | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function ComposeModal({ onClose, onScheduled, pushToast, webhookUrl }: Props) {
  const { t } = useI18n();
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

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const attachRef = useRef<HTMLInputElement>(null);

  const [webhook, setWebhook] = useState(webhookUrl ?? "");
  const [webhookBusy, setWebhookBusy] = useState(false);

  useEffect(() => {
    api.templates().then((r) => setTemplates(r.templates)).catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const res = await api.parseLeads(file);
      setEmails(res.emails);
      setFileName(file.name);
      pushToast(`${t("detectedEmails")} ${res.count} ${t("emailWord")}${res.count === 1 ? "" : "s"}`);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Failed to parse file", "err");
    } finally {
      setParsing(false);
    }
  };

  const handleAttachments = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (attachments.length >= 5) {
        pushToast(t("maxAttachments"), "err");
        break;
      }
      const dataBase64 = await fileToBase64(f);
      setAttachments((a) => [
        ...a,
        { filename: f.name, contentType: f.type || "application/octet-stream", size: f.size, dataBase64 },
      ]);
    }
    if (attachRef.current) attachRef.current.value = "";
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((x) => x.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !subject.trim() || !body.trim()) {
      pushToast(t("templateSaveFail"), "err");
      return;
    }
    try {
      const { template } = await api.createTemplate({
        name: templateName.trim(),
        subject,
        body,
      });
      setTemplates((x) => [template, ...x]);
      setTemplateName("");
      pushToast(t("templateSaved"));
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Failed", "err");
    }
  };

  const saveWebhook = async () => {
    setWebhookBusy(true);
    try {
      await api.setWebhook(webhook.trim() || null);
      pushToast(webhook.trim() ? t("webhookSaved") : t("webhookCleared"));
    } catch (e) {
      pushToast(e instanceof Error ? e.message : t("webhookSaveFail"), "err");
    } finally {
      setWebhookBusy(false);
    }
  };

  const submit = async () => {
    if (emails.length === 0) {
      pushToast(t("needLeads"), "err");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      pushToast(t("needSubjectBody"), "err");
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
        attachments: attachments.map(({ filename, contentType, dataBase64 }) => ({
          filename,
          contentType,
          dataBase64,
        })),
      });
      pushToast(`${t("scheduledOk")} ${res.scheduled} ${t("emailsWord")}`);
      onScheduled(res.scheduled);
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : t("scheduledFail"), "err");
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("composeTitle")}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {templates.length > 0 && (
            <div>
              <label className={labelCls}>{t("template")}</label>
              <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={inputCls}>
                <option value="">{t("startBlank")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>{t("leads")}</label>
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
              className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400"
            >
              {parsing
                ? t("parsing")
                : fileName
                  ? `${fileName} — ${emails.length} ${t("emailWord")}${emails.length === 1 ? "" : "s"}`
                  : t("uploadLeads")}
            </button>
          </div>

          <div>
            <label className={labelCls}>{t("subject")}</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("subjectPlaceholder")}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t("body")}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={t("bodyPlaceholder")}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              {t("attachments")} <span className="font-normal text-slate-400">{t("attachmentsHint")}</span>
            </label>
            <input
              ref={attachRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleAttachments(e.target.files)}
            />
            <button
              onClick={() => attachRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400"
            >
              {t("addAttachments")}
            </button>
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <span className="truncate">
                      {a.filename} <span className="text-slate-400">({(a.size / 1024).toFixed(1)} KB)</span>
                    </span>
                    <button
                      onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}
                      className="ml-2 text-rose-500 hover:text-rose-700"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t("startTime")}</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("delayBetween")}</label>
              <input
                type="number"
                min={0}
                step={1}
                value={delaySec}
                onChange={(e) => setDelaySec(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("hourlyLimit")}</label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <label className={labelCls}>{t("saveAsTemplate")}</label>
            <div className="flex gap-2">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("templateNamePlaceholder")}
                className={`${inputCls} flex-1 !py-1.5`}
              />
              <button
                onClick={saveTemplate}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t("save")}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <label className={labelCls}>
              {t("webhook")} <span className="font-normal text-slate-400">{t("webhookHint")}</span>
            </label>
            <div className="flex gap-2">
              <input
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://example.com/hook"
                className={`${inputCls} flex-1 !py-1.5`}
              />
              <button
                onClick={saveWebhook}
                disabled={webhookBusy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {webhookBusy ? "…" : t("save")}
              </button>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={submitting || emails.length === 0}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? t("scheduling")
              : `${t("scheduleBtn")} ${emails.length || ""} ${t("emailsWord")}${emails.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
