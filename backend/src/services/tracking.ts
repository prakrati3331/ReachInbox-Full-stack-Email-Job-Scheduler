import { config } from "../config";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const OPEN_PIXEL = PIXEL_GIF;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;

/**
 * Build the HTML body for an email: paragraphs from plain text, URLs are
 * linkified through the click-tracking redirect, and a 1x1 open-tracking
 * pixel is appended. `token` is the per-recipient tracking token.
 */
export function buildTrackedHtml(body: string, token: string | null): string {
  const api = config.apiPublicUrl.replace(/\/$/, "");
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const linked = escapeHtml(p).replace(URL_RE, (raw) => {
        // raw is already HTML-escaped; &amp; inside URLs must be decoded for the redirect target
        const url = raw.replace(/&amp;/g, "&");
        const href = token
          ? `${api}/api/track/c/${token}?u=${encodeURIComponent(url)}`
          : url;
        return `<a href="${href}" style="color:#4f46e5">${raw}</a>`;
      });
      return `<p style="margin:0 0 12px;line-height:1.6">${linked.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  const pixel = token
    ? `<img src="${api}/api/track/o/${token}.gif" width="1" height="1" alt="" style="display:none" />`
    : "";

  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111">${paragraphs}${pixel}</body></html>`;
}
