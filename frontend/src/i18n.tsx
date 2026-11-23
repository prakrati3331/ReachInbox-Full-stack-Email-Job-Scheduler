import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "es" | "hi";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी" },
];

type Dict = Record<string, string>;

const en: Dict = {
  tagline: "Reliable email scheduling & sending at scale.",
  continueGoogle: "Continue with Google",
  devOnly: "dev only",
  emailPlaceholder: "dev@example.com",
  namePlaceholder: "Name (optional)",
  devLogin: "Dev login",
  signingIn: "Signing in…",
  devLoginNote: "Dev login requires ALLOW_DEV_LOGIN=true on the backend.",

  connectSlack: "Connect Slack",
  slackConnected: "Slack",
  pickChannel: "Pick channel…",
  disconnect: "Disconnect",
  logout: "Logout",

  tabScheduled: "Scheduled Emails",
  tabSent: "Sent Emails",
  searchPlaceholder: "Search emails (Elasticsearch)…",
  search: "Search",
  searching: "…",
  compose: "+ Compose New Email",
  exportCsv: "Export CSV",
  clearSent: "Clear sent",
  clearSentConfirm: "Delete all sent/failed emails? This cannot be undone.",
  emptyScheduled: "No scheduled emails yet — compose one to get started.",
  emptySent: "No sent emails yet.",
  noMatches: "No matches found.",
  bullBoard: "Live queue dashboard:",
  loadFailed: "Failed to load",
  searchFailed: "Search failed",

  colEmail: "Email",
  colSubject: "Subject",
  colScheduled: "Scheduled",
  colSent: "Sent",
  colStatus: "Status",
  opened: "opened",
  clicked: "clicked",
  cancel: "Cancel",
  delete: "Delete",
  deletedOk: "Deleted",
  deleteFailed: "Delete failed",

  st_scheduled: "scheduled",
  st_rate_limited: "rate limited",
  st_sending: "sending",
  st_sent: "sent",
  st_failed: "failed",

  composeTitle: "Compose New Email",
  template: "Template",
  startBlank: "— Start blank —",
  leads: "Leads (CSV / TXT)",
  uploadLeads: "Click to upload CSV or TXT file",
  subject: "Subject",
  subjectPlaceholder: "Your email subject",
  body: "Body",
  bodyPlaceholder: "Email body…",
  attachments: "Attachments",
  attachmentsHint: "(optional, max 5 · 8MB total)",
  addAttachments: "+ Add attachments",
  maxAttachments: "Max 5 attachments",
  startTime: "Start time",
  delayBetween: "Delay between (sec)",
  hourlyLimit: "Hourly limit",
  saveAsTemplate: "Save as template",
  templateNamePlaceholder: "Template name",
  save: "Save",
  templateSaved: "Template saved",
  templateSaveFail: "Name, subject and body needed to save a template",
  webhook: "Status webhook",
  webhookHint: "(POSTed on sent/failed)",
  webhookSaved: "Webhook URL saved",
  webhookCleared: "Webhook cleared",
  webhookSaveFail: "Failed to save webhook",
  scheduleBtn: "Schedule",
  emailsWord: "emails",
  scheduledOk: "Scheduled",
  scheduledFail: "Scheduling failed",
  needLeads: "Upload a CSV/TXT file with email leads first",
  needSubjectBody: "Subject and body are required",
  detectedEmails: "Detected",
  emailWord: "email",
  parsing: "Parsing…",
  scheduling: "Scheduling…",
  failedBatchToast: "emails failed to send",
};

const es: Dict = {
  tagline: "Programación y envío de correos fiable a escala.",
  continueGoogle: "Continuar con Google",
  devOnly: "solo dev",
  emailPlaceholder: "dev@ejemplo.com",
  namePlaceholder: "Nombre (opcional)",
  devLogin: "Acceso dev",
  signingIn: "Iniciando sesión…",
  devLoginNote: "El acceso dev requiere ALLOW_DEV_LOGIN=true en el backend.",

  connectSlack: "Conectar Slack",
  slackConnected: "Slack",
  pickChannel: "Elige canal…",
  disconnect: "Desconectar",
  logout: "Cerrar sesión",

  tabScheduled: "Correos programados",
  tabSent: "Correos enviados",
  searchPlaceholder: "Buscar correos (Elasticsearch)…",
  search: "Buscar",
  searching: "…",
  compose: "+ Redactar correo",
  exportCsv: "Exportar CSV",
  clearSent: "Borrar enviados",
  clearSentConfirm: "¿Eliminar todos los correos enviados/fallidos? No se puede deshacer.",
  emptyScheduled: "Aún no hay correos programados — redacta uno para empezar.",
  emptySent: "Aún no hay correos enviados.",
  noMatches: "Sin resultados.",
  bullBoard: "Panel de cola en vivo:",
  loadFailed: "Error al cargar",
  searchFailed: "Error en la búsqueda",

  colEmail: "Correo",
  colSubject: "Asunto",
  colScheduled: "Programado",
  colSent: "Enviado",
  colStatus: "Estado",
  opened: "abierto",
  clicked: "clic",
  cancel: "Cancelar",
  delete: "Eliminar",
  deletedOk: "Eliminado",
  deleteFailed: "Error al eliminar",

  st_scheduled: "programado",
  st_rate_limited: "límite por hora",
  st_sending: "enviando",
  st_sent: "enviado",
  st_failed: "fallido",

  composeTitle: "Redactar correo",
  template: "Plantilla",
  startBlank: "— Empezar en blanco —",
  leads: "Contactos (CSV / TXT)",
  uploadLeads: "Haz clic para subir CSV o TXT",
  subject: "Asunto",
  subjectPlaceholder: "El asunto del correo",
  body: "Cuerpo",
  bodyPlaceholder: "Cuerpo del correo…",
  attachments: "Archivos adjuntos",
  attachmentsHint: "(opcional, máx. 5 · 8MB total)",
  addAttachments: "+ Añadir adjuntos",
  maxAttachments: "Máximo 5 adjuntos",
  startTime: "Hora de inicio",
  delayBetween: "Retraso entre envíos (seg)",
  hourlyLimit: "Límite por hora",
  saveAsTemplate: "Guardar como plantilla",
  templateNamePlaceholder: "Nombre de plantilla",
  save: "Guardar",
  templateSaved: "Plantilla guardada",
  templateSaveFail: "Se necesitan nombre, asunto y cuerpo",
  webhook: "Webhook de estado",
  webhookHint: "(POST al enviar/fallar)",
  webhookSaved: "Webhook guardado",
  webhookCleared: "Webhook eliminado",
  webhookSaveFail: "Error al guardar el webhook",
  scheduleBtn: "Programar",
  emailsWord: "correos",
  scheduledOk: "Programados",
  scheduledFail: "Error al programar",
  needLeads: "Sube primero un archivo CSV/TXT con correos",
  needSubjectBody: "El asunto y el cuerpo son obligatorios",
  detectedEmails: "Detectados",
  emailWord: "correo",
  parsing: "Procesando…",
  scheduling: "Programando…",
  failedBatchToast: "correos fallaron al enviar",
};

const hi: Dict = {
  tagline: "स्केल पर भरोसेमंद ईमेल शेड्यूलिंग और भेजना।",
  continueGoogle: "Google से जारी रखें",
  devOnly: "केवल dev",
  emailPlaceholder: "dev@example.com",
  namePlaceholder: "नाम (वैकल्पिक)",
  devLogin: "Dev लॉगिन",
  signingIn: "साइन इन हो रहा है…",
  devLoginNote: "Dev लॉगिन के लिए backend पर ALLOW_DEV_LOGIN=true होना चाहिए।",

  connectSlack: "Slack कनेक्ट करें",
  slackConnected: "Slack",
  pickChannel: "चैनल चुनें…",
  disconnect: "डिस्कनेक्ट",
  logout: "लॉगआउट",

  tabScheduled: "शेड्यूल किए गए ईमेल",
  tabSent: "भेजे गए ईमेल",
  searchPlaceholder: "ईमेल खोजें (Elasticsearch)…",
  search: "खोजें",
  searching: "…",
  compose: "+ नया ईमेल लिखें",
  exportCsv: "CSV निर्यात",
  clearSent: "भेजे गए हटाएं",
  clearSentConfirm: "सभी भेजे/विफल ईमेल हटाएं? यह वापस नहीं होगा।",
  emptyScheduled: "अभी कोई शेड्यूल किया ईमेल नहीं — शुरू करने के लिए एक बनाएं।",
  emptySent: "अभी कोई भेजा गया ईमेल नहीं।",
  noMatches: "कोई परिणाम नहीं।",
  bullBoard: "लाइव क्यू डैशबोर्ड:",
  loadFailed: "लोड करने में विफल",
  searchFailed: "खोज विफल",

  colEmail: "ईमेल",
  colSubject: "विषय",
  colScheduled: "शेड्यूल समय",
  colSent: "भेजा गया",
  colStatus: "स्थिति",
  opened: "खोला गया",
  clicked: "क्लिक",
  cancel: "रद्द करें",
  delete: "हटाएं",
  deletedOk: "हटाया गया",
  deleteFailed: "हटाने में विफल",

  st_scheduled: "शेड्यूल",
  st_rate_limited: "दर सीमा",
  st_sending: "भेजा जा रहा",
  st_sent: "भेजा गया",
  st_failed: "विफल",

  composeTitle: "नया ईमेल लिखें",
  template: "टेम्पलेट",
  startBlank: "— खाली शुरू करें —",
  leads: "लीड्स (CSV / TXT)",
  uploadLeads: "CSV या TXT अपलोड करने के लिए क्लिक करें",
  subject: "विषय",
  subjectPlaceholder: "आपका ईमेल विषय",
  body: "संदेश",
  bodyPlaceholder: "ईमेल संदेश…",
  attachments: "अटैचमेंट",
  attachmentsHint: "(वैकल्पिक, अधिकतम 5 · 8MB कुल)",
  addAttachments: "+ अटैचमेंट जोड़ें",
  maxAttachments: "अधिकतम 5 अटैचमेंट",
  startTime: "शुरू समय",
  delayBetween: "बीच का अंतराल (सेकंड)",
  hourlyLimit: "प्रति घंटा सीमा",
  saveAsTemplate: "टेम्पलेट के रूप में सहेजें",
  templateNamePlaceholder: "टेम्पलेट का नाम",
  save: "सहेजें",
  templateSaved: "टेम्पलेट सहेजा गया",
  templateSaveFail: "टेम्पलेट के लिए नाम, विषय और संदेश ज़रूरी हैं",
  webhook: "स्टेटस webhook",
  webhookHint: "(भेजे/विफल पर POST)",
  webhookSaved: "Webhook सहेजा गया",
  webhookCleared: "Webhook हटाया गया",
  webhookSaveFail: "Webhook सहेजने में विफल",
  scheduleBtn: "शेड्यूल करें",
  emailsWord: "ईमेल",
  scheduledOk: "शेड्यूल किए गए",
  scheduledFail: "शेड्यूल करने में विफल",
  needLeads: "पहले ईमेल वाली CSV/TXT फ़ाइल अपलोड करें",
  needSubjectBody: "विषय और संदेश आवश्यक हैं",
  detectedEmails: "मिले",
  emailWord: "ईमेल",
  parsing: "पार्स हो रहा है…",
  scheduling: "शेड्यूल हो रहा है…",
  failedBatchToast: "ईमेल भेजने में विफल",
};

const dicts: Record<Lang, Dict> = { en, es, hi };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    return saved === "es" || saved === "hi" ? saved : "en";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const t = (key: string) => dicts[lang][key] ?? dicts.en[key] ?? key;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
