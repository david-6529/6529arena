import { randomUUID } from "node:crypto";

type TelemetryProperties = Record<string, unknown>;

function posthogKey() {
  return process.env.POSTHOG_PROJECT_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

function posthogHost() {
  return (process.env.POSTHOG_HOST ?? "https://app.posthog.com").replace(/\/$/, "");
}

function isPosthogConfigured() {
  return Boolean(posthogKey());
}

function parseSentryDsn() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    return undefined;
  }

  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).at(-1);

    if (!projectId || !url.username) {
      return undefined;
    }

    return {
      dsn,
      publicKey: url.username,
      projectId,
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return undefined;
  }
}

function sanitizeProperties(properties: TelemetryProperties = {}) {
  return JSON.parse(JSON.stringify(properties)) as TelemetryProperties;
}

export async function captureTelemetryEvent(
  event: string,
  properties: TelemetryProperties = {},
  distinctId = "server",
) {
  const apiKey = posthogKey();

  if (!apiKey || process.env.OBSERVABILITY_CAPTURE_APP_EVENTS !== "true") {
    return;
  }

  try {
    await fetch(`${posthogHost()}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: sanitizeProperties(properties),
      }),
    });
  } catch (error) {
    console.error("PostHog capture failed", error);
  }
}

export async function captureTelemetryException(
  error: unknown,
  properties: TelemetryProperties = {},
) {
  await Promise.all([
    capturePosthogException(error, properties),
    captureSentryException(error, properties),
  ]);
}

async function capturePosthogException(error: unknown, properties: TelemetryProperties) {
  if (!isPosthogConfigured()) {
    return;
  }

  const message = error instanceof Error ? error.message : String(error);

  try {
    await fetch(`${posthogHost()}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey(),
        event: "server_exception",
        distinct_id: "server",
        properties: sanitizeProperties({
          ...properties,
          message,
          name: error instanceof Error ? error.name : typeof error,
        }),
      }),
    });
  } catch (captureError) {
    console.error("PostHog exception capture failed", captureError);
  }
}

async function captureSentryException(error: unknown, properties: TelemetryProperties) {
  const sentry = parseSentryDsn();

  if (!sentry) {
    return;
  }

  const eventId = randomUUID().replaceAll("-", "");
  const message = error instanceof Error ? error.message : String(error);
  const now = new Date().toISOString();
  const envelopeHeader = {
    event_id: eventId,
    dsn: sentry.dsn,
    sent_at: now,
  };
  const itemHeader = { type: "event" };
  const payload = {
    event_id: eventId,
    platform: "javascript",
    level: "error",
    timestamp: Date.now() / 1000,
    message,
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : typeof error,
          value: message,
          stacktrace: error instanceof Error ? { frames: [{ filename: "server", function: error.stack }] } : undefined,
        },
      ],
    },
    extra: sanitizeProperties(properties),
  };
  const envelope = `${JSON.stringify(envelopeHeader)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(payload)}`;

  try {
    await fetch(sentry.envelopeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${sentry.publicKey}, sentry_client=agent-arena/1.0`,
      },
      body: envelope,
    });
  } catch (captureError) {
    console.error("Sentry exception capture failed", captureError);
  }
}
