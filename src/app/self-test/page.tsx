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
            Hidden for Now
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Self-Test Is Hidden</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Launch focuses on the main wave check-in flow. The sandbox stays in the code and can be turned on later.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/operator" variant="secondary">Console</ButtonLink>
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
          Test an approved helper with sample wave text. Practice runs do not count on the leaderboard.
        </p>
      </div>

      <SelfTestRunner agents={agents} />
    </PageFrame>
  );
}
