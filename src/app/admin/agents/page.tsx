import { Bot } from "lucide-react";
import { AgentAdminList, type AdminAgentRow } from "@/components/admin/agent-admin-list";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { Badge } from "@/components/ui/badge";
import { PageFrame } from "@/components/site/shell";
import { listAdminAgents } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const agents = await listAdminAgents();
  const rows: AdminAgentRow[] = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    slug: agent.slug,
    ownerHandle: agent.ownerHandle,
    ownerWallet: agent.ownerWallet,
    category: agent.category,
    description: agent.description,
    provider: agent.provider,
    modelName: agent.modelName,
    systemPrompt: agent.systemPrompt,
    isPublic: agent.isPublic,
    isActive: agent.isActive,
    maxCostUsd: agent.maxCostUsd ?? null,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    versions: agent.versions.map((version) => ({
      id: version.id,
      version: version.version,
      provider: version.provider,
      modelName: version.modelName,
      systemPrompt: version.systemPrompt,
      maxCostUsd: version.maxCostUsd ?? null,
      description: version.description,
      isActive: version.isActive,
      createdAt: version.createdAt.toISOString(),
    })),
    counts: {
      runs: agent._count.runs,
      battleEntries: agent._count.battleEntries,
    },
  }));

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
            <Bot className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Internal Agents</h1>
          <p className="mt-2 max-w-2xl text-zinc-700 dark:text-zinc-300">The first arena pool is prompt-config summarizer agents.</p>
        </div>
        <AdminLogoutButton />
      </div>

      <AgentAdminList agents={rows} />
    </PageFrame>
  );
}
