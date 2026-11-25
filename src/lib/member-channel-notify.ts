/**
 * Member-facing channel notify (Resend e-posta + Telegram bot).
 * All secrets via env; missing config → channel skipped (no throw).
 */

export type MemberNotifyChannelResult = {
  channel: "email" | "telegram" | "inbox";
  status: "SENT" | "SKIPPED" | "FAILED";
  detail: string;
};

export type MemberNotifyPayload = {
  userId: string;
  email: string;
  name: string;
  telegramHandle: string | null;
  notifyEmailEnabled: boolean;
  notifyTelegramEnabled: boolean;
  subject: string;
  text: string;
  /** When true, also write an admin→member SupportMessage. */
  writeInbox?: boolean;
};

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<MemberNotifyChannelResult> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("RESEND_FROM");
  if (!apiKey || !from) {
    return {
      channel: "email",
      status: "SKIPPED",
      detail: "RESEND_API_KEY / RESEND_FROM missing",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        channel: "email",
        status: "FAILED",
        detail: `HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
      };
    }
    return { channel: "email", status: "SENT", detail: "ok" };
  } catch (error: unknown) {
    return {
      channel: "email",
      status: "FAILED",
      detail: error instanceof Error ? error.message : "email send failed",
    };
  }
}

async function sendTelegramMessage(input: {
  handle: string;
  text: string;
}): Promise<MemberNotifyChannelResult> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) {
    return {
      channel: "telegram",
      status: "SKIPPED",
      detail: "TELEGRAM_BOT_TOKEN missing",
    };
  }

  const handle = input.handle.replace(/^@/, "").trim();
  if (!handle) {
    return {
      channel: "telegram",
      status: "SKIPPED",
      detail: "empty telegram handle",
    };
  }

  // Bot API needs chat_id; username resolve via getChat when handle looks numeric, else @username.
  const chatId = /^-?\d+$/.test(handle) ? handle : `@${handle}`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: input.text,
          disable_web_page_preview: true,
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        channel: "telegram",
        status: "FAILED",
        detail: `HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
      };
    }
    return { channel: "telegram", status: "SENT", detail: "ok" };
  } catch (error: unknown) {
    return {
      channel: "telegram",
      status: "FAILED",
      detail: error instanceof Error ? error.message : "telegram send failed",
    };
  }
}

export async function notifyMemberChannels(
  payload: MemberNotifyPayload,
  writeInbox: (userId: string, body: string) => Promise<void>,
): Promise<MemberNotifyChannelResult[]> {
  const results: MemberNotifyChannelResult[] = [];

  if (payload.writeInbox !== false) {
    try {
      await writeInbox(payload.userId, payload.text);
      results.push({ channel: "inbox", status: "SENT", detail: "support message" });
    } catch (error: unknown) {
      results.push({
        channel: "inbox",
        status: "FAILED",
        detail: error instanceof Error ? error.message : "inbox write failed",
      });
    }
  }

  if (payload.notifyEmailEnabled) {
    results.push(
      await sendResendEmail({
        to: payload.email,
        subject: payload.subject,
        text: payload.text,
      }),
    );
  } else {
    results.push({
      channel: "email",
      status: "SKIPPED",
      detail: "notifyEmailEnabled=false",
    });
  }

  if (payload.notifyTelegramEnabled && payload.telegramHandle) {
    results.push(
      await sendTelegramMessage({
        handle: payload.telegramHandle,
        text: `${payload.subject}\n\n${payload.text}`,
      }),
    );
  } else {
    results.push({
      channel: "telegram",
      status: "SKIPPED",
      detail: payload.notifyTelegramEnabled
        ? "telegramHandle missing"
        : "notifyTelegramEnabled=false",
    });
  }

  return results;
}
