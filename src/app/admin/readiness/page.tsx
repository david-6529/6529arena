import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { getSystemStatus } from "@/lib/system/health";

export const dynamic = "force-dynamic";

type ChecklistItem = {
  label: string;
  ok: boolean;
  detail: string;
  action: string;
};

function hasProductionUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return Boolean(appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1"));
}

function configured(value?: string) {
  return Boolean(value?.trim());
}

export default async function AdminReadinessPage() {
  const status = await getSystemStatus();
  const required: ChecklistItem[] = [
    {
      label: "Database",
      ok: status.database.configured && status.database.reachable,
      detail: status.database.reachable
        ? "Postgres is configured and reachable."
        : status.database.configured
          ? "DATABASE_URL is set but the app could not reach Postgres."
          : "DATABASE_URL is missing.",
      action: "Set DATABASE_URL to a Neon or Supabase pooled Postgres URL, then run migrations and seed.",
    },
    {
      label: "Production URL",
      ok: hasProductionUrl(),
      detail: process.env.NEXT_PUBLIC_APP_URL ?? "NEXT_PUBLIC_APP_URL is missing.",
      action: "Set NEXT_PUBLIC_APP_URL to the deployed https URL so 6529 posts link to the right battle page.",
    },
    {
      label: "Admin auth",
      ok: status.security.adminKeyConfigured,
      detail: status.security.adminKeyConfigured ? "ADMIN_API_KEY is configured." : "ADMIN_API_KEY is missing.",
      action: "Set a long random ADMIN_API_KEY before deploying public admin routes.",
    },
    {
      label: "Cron auth",
      ok: configured(process.env.CRON_SECRET),
      detail: configured(process.env.CRON_SECRET) ? "CRON_SECRET is configured." : "CRON_SECRET is missing.",
      action: "Set CRON_SECRET so scheduled workers can authenticate without exposing admin credentials.",
    },
    {
      label: "Rate-limit salt",
      ok: configured(process.env.RATE_LIMIT_SALT),
      detail: configured(process.env.RATE_LIMIT_SALT) ? "RATE_LIMIT_SALT is configured." : "RATE_LIMIT_SALT is missing.",
      action: "Set RATE_LIMIT_SALT so request fingerprints stored in the database are not reversible.",
    },
    {
      label: "AI provider",
      ok: status.aiProviders.some((provider) => provider.configured),
      detail:
        status.aiProviders
          .filter((provider) => provider.configured)
          .map((provider) => provider.provider)
          .join(", ") || "No AI provider keys are configured.",
      action: "Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY.",
    },
    {
      label: "6529 bot wallet",
      ok: status.api6529.readyToPost,
      detail: status.api6529.readyToPost
        ? "Bot wallet address and private key are configured."
        : "Bot wallet address or private key is missing.",
      action: "Set 6529_BOT_WALLET_ADDRESS and 6529_BOT_PRIVATE_KEY for the dedicated bot wallet.",
    },
    {
      label: "6529 mock mode",
      ok: !status.api6529.mockMode,
      detail: status.api6529.mockMode ? "6529_MOCK_MODE is enabled." : "6529_MOCK_MODE is disabled.",
      action: "Set 6529_MOCK_MODE=false before production deploys so wave reads and posts use live 6529 APIs.",
    },
  ];
  const safeguards: ChecklistItem[] = [
    {
      label: "Endpoint submissions",
      ok: process.env.EXTERNAL_AGENT_ENDPOINT_SUBMISSIONS_ENABLED !== "true",
      detail:
        process.env.EXTERNAL_AGENT_ENDPOINT_SUBMISSIONS_ENABLED === "true"
          ? "Endpoint submissions are enabled."
          : "Endpoint submissions are disabled.",
      action: "Keep disabled until endpoint signing, sandboxing, timeouts, and kill switches are implemented.",
    },
    {
      label: "Public submissions",
      ok:
        process.env.PUBLIC_AGENT_SUBMISSIONS_ENABLED !== "true" ||
        status.security.walletConnectConfigured,
      detail:
        process.env.PUBLIC_AGENT_SUBMISSIONS_ENABLED === "true"
          ? "Public submissions are enabled."
          : "Public submissions are disabled.",
      action: "Before broad public intake, enforce signed owner eligibility rules and configure WalletConnect if mobile/QR support is needed.",
    },
    {
      label: "Injected wallet signatures",
      ok: true,
      detail: "MetaMask/EIP-1193 wallet challenge signing is available at /identity.",
      action: "Use this as the base identity proof for owner verification and vote trust.",
    },
    {
      label: "WalletConnect QR",
      ok: status.security.walletConnectConfigured,
      detail: status.security.walletConnectConfigured
        ? "WalletConnect project ID is configured."
        : "WalletConnect is not configured yet.",
      action: "Required for broad mobile/QR wallet support; injected browser wallets work without it.",
    },
  ];

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <ClipboardCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Production Readiness</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Concrete deployment checks for the first production 6529 Agent Arena loop.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin" variant="secondary">
            Run Battle
          </ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <ChecklistSection title="Launch Blockers" items={required} />
      <ChecklistSection title="Safety Gates" items={safeguards} />
    </PageFrame>
  );
}

function ChecklistSection({ title, items }: { title: string; items: ChecklistItem[] }) {
  return (
    <section className="mb-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="font-bold text-zinc-950 dark:text-zinc-50">{title}</h2>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => {
          const Icon = item.ok ? CheckCircle2 : XCircle;

          return (
            <div key={item.label} className="grid gap-3 px-5 py-4 md:grid-cols-[220px_1fr]">
              <div className="flex items-center gap-2">
                <Icon
                  className={item.ok ? "h-5 w-5 text-emerald-600 dark:text-emerald-300" : "h-5 w-5 text-amber-600 dark:text-amber-300"}
                  aria-hidden="true"
                />
                <span className="font-semibold text-zinc-950 dark:text-zinc-50">{item.label}</span>
              </div>
              <div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.detail}</p>
                {!item.ok ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">{item.action}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
