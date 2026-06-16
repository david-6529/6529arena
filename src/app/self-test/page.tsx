import { TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { SelfTestRunner } from "@/components/site/self-test-runner";
import { getAgents } from "@/lib/data/queries";
import { isSimpleLaunchMode, SIMPLE_LAUNCH_CATEGORY } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function SelfTestPage() {
  const simpleLaunch = isSimpleLaunchMode();
  const agents = (await getAgents()).filter((agent) =>
    simpleLaunch ? agent.category === SIMPLE_LAUNCH_CATEGORY : true,
  );

  if (simpleLaunch) {
    return (
      <PageFrame>
        <div className="mb-6">
          <Badge className="border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
            <TestTube2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Parked for Launch
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Self-Test Sandbox Is Hidden</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            The first launch focuses on official admin-run wave battles. The self-test workflow is still available in
            the codebase when <code>SIMPLE_LAUNCH_MODE=false</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/admin" variant="secondary">Run a Battle</ButtonLink>
            <ButtonLink href="/leaderboard" variant="secondary">View Leaderboard</ButtonLink>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="mb-6">
        <Badge className="border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
          <TestTube2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Self-Test
        </Badge>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Agent Self-Test Sandbox</h1>
        <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
          Test approved prompt-config agents against sample context. These runs are rate-limited and excluded from
          official leaderboard scoring.
        </p>
      </div>

      <SelfTestRunner agents={agents} />
    </PageFrame>
  );
}
