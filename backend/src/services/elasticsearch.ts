import { Client } from "@elastic/elasticsearch";
import { config } from "../config";
import { prisma } from "../lib/prisma";

// Accepts ELASTICSEARCH_URL either bare (http://host:9200) or with
// credentials embedded (https://user:pass@host:443) — common for
// Elastic Cloud deployments.
const esNode = new URL(config.elasticsearchUrl);
// Auth precedence: ELASTICSEARCH_API_KEY env > "apikey:TOKEN@host" URL
// convention > user:password basic auth embedded in the URL.
const urlApiKey =
  esNode.username === "apikey"
    ? decodeURIComponent(esNode.password)
    : null;
const esApiKey = process.env.ELASTICSEARCH_API_KEY ?? urlApiKey;
const client = new Client({
  node: `${esNode.protocol}//${esNode.host}`,
  auth: esApiKey
    ? { apiKey: esApiKey }
    : esNode.username
      ? {
          username: decodeURIComponent(esNode.username),
          password: decodeURIComponent(esNode.password),
        }
      : undefined,
});

let ensured = false;

export async function ensureIndex(): Promise<void> {
  if (ensured) return;
  const exists = await client.indices.exists({ index: config.esIndex });
  if (!exists) {
    await client.indices.create({
      index: config.esIndex,
      mappings: {
        properties: {
          emailId: { type: "keyword" },
          userId: { type: "keyword" },
          recipient: { type: "text" },
          fromEmail: { type: "keyword" },
          fromName: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
          openedAt: { type: "date" },
          clickedAt: { type: "date" },
        },
      },
    });
  }
  ensured = true;
}

export async function indexEmail(emailId: string): Promise<void> {
  try {
    await ensureIndex();
    const email = await prisma.scheduledEmail.findUnique({ where: { id: emailId } });
    if (!email) return;
    await client.index({
      index: config.esIndex,
      id: email.id,
      document: {
        emailId: email.id,
        userId: email.userId,
        recipient: email.recipient,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt?.toISOString() ?? null,
        openedAt: email.openedAt?.toISOString() ?? null,
        clickedAt: email.clickedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error("[elasticsearch] indexEmail failed:", err);
  }
}

export async function deleteEmailIndex(emailId: string): Promise<void> {
  try {
    await ensureIndex();
    await client.delete({ index: config.esIndex, id: emailId });
  } catch (err: unknown) {
    const status = (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
    if (status !== 404) console.error("[elasticsearch] deleteEmailIndex failed:", err);
  }
}

export async function searchEmails(userId: string, q: string, size = 50) {
  try {
    await ensureIndex();
    const result = await client.search({
      index: config.esIndex,
      size,
      query: {
        bool: {
          filter: [{ term: { userId } }],
          must: q
            ? [
                {
                  multi_match: {
                    query: q,
                    fields: ["recipient", "subject", "body", "fromEmail", "fromName"],
                  },
                },
              ]
            : [{ match_all: {} }],
        },
      },
      sort: [{ scheduledAt: "desc" }],
    });
    return result.hits.hits.map((h) => h._source);
  } catch (err) {
    console.error("[elasticsearch] search failed:", err);
    return [];
  }
}
