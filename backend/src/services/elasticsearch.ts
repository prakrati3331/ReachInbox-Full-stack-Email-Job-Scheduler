import { Client } from "@elastic/elasticsearch";
import { config } from "../config";
import { prisma } from "../lib/prisma";

const client = new Client({ node: config.elasticsearchUrl });

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
      },
    });
  } catch (err) {
    console.error("[elasticsearch] indexEmail failed:", err);
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
