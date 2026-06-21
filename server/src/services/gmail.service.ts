import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { env, GMAIL_SCOPES } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  withRetry,
  extractEmailBody,
  parseEmailAddress,
} from "../utils/helpers.js";
import { GmailAccount } from "../types/index.js";

export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getUserProfile(accessToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

export function getGmailClient(account: GmailAccount): gmail_v1.Gmail {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
  });

  client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      logger.debug("Gmail tokens refreshed");
    }
  });

  return google.gmail({ version: "v1", auth: client });
}

export async function refreshAccessToken(refreshToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return credentials;
}

export async function listMessageIds(
  gmail: gmail_v1.Gmail,
  pageToken?: string,
  maxResults = 100,
): Promise<{ ids: string[]; nextPageToken?: string }> {
  return withRetry(async () => {
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      pageToken,
    });
    return {
      ids: (res.data.messages ?? []).map((m) => m.id!),
      nextPageToken: res.data.nextPageToken ?? undefined,
    };
  }, "gmail-list-messages");
}

export async function getMessage(gmail: gmail_v1.Gmail, messageId: string) {
  return withRetry(async () => {
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    return res.data;
  }, "gmail-get-message");
}

export async function getThread(gmail: gmail_v1.Gmail, threadId: string) {
  return withRetry(async () => {
    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
    return res.data;
  }, "gmail-get-thread");
}

export async function listLabels(gmail: gmail_v1.Gmail) {
  return withRetry(async () => {
    const res = await gmail.users.labels.list({ userId: "me" });
    return res.data.labels ?? [];
  }, "gmail-list-labels");
}

export async function getHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
  pageToken?: string,
) {
  return withRetry(async () => {
    const res = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: [
        "messageAdded",
        "messageDeleted",
        "labelAdded",
        "labelRemoved",
      ],
      pageToken,
    });
    return res.data;
  }, "gmail-history");
}

export async function sendEmail(
  gmail: gmail_v1.Gmail,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  inReplyTo?: string,
  references?: string,
) {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];

  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);

  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return withRetry(async () => {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId,
      },
    });
    return res.data;
  }, "gmail-send");
}

export function parseGmailMessage(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    "";

  const { text, html } = extractEmailBody(
    (message.payload ?? {}) as Parameters<typeof extractEmailBody>[0],
  );
  const from = parseEmailAddress(getHeader("From"));

  return {
    gmail_message_id: message.id!,
    gmail_thread_id: message.threadId!,
    subject: getHeader("Subject"),
    from_email: from.email,
    from_name: from.name,
    to_emails: getHeader("To")
      .split(",")
      .map((e) => parseEmailAddress(e.trim()).email),
    cc_emails: getHeader("Cc")
      .split(",")
      .filter(Boolean)
      .map((e) => parseEmailAddress(e.trim()).email),
    body_text: text,
    body_html: html,
    snippet: message.snippet ?? "",
    received_at: message.internalDate
      ? new Date(parseInt(message.internalDate)).toISOString()
      : null,
    is_unread: (message.labelIds ?? []).includes("UNREAD"),
    label_ids: message.labelIds ?? [],
    in_reply_to: getHeader("In-Reply-To") || null,
    references_header: getHeader("References") || null,
    headers: Object.fromEntries(headers.map((h) => [h.name!, h.value!])),
  };
}
