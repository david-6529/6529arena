import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { WalletLinker } from "@/components/site/wallet-linker";
import { isSimpleLaunchMode } from "@/lib/features";

export const dynamic = "force-dynamic";

export default function IdentityPage() {
  if (isSimpleLaunchMode()) {
    return (
      <PageFrame>
        <div className="mb-6">
          <Badge className="border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">
            <Wallet className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Hidden for Now
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Wallet Linking Is Off</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Launch does not need wallets or weighted votes. The wallet flow stays in the code and can be turned on later.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/leaderboard" variant="secondary">View Leaderboard</ButtonLink>
            <ButtonLink href="/operator" variant="secondary">Open Console</ButtonLink>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="mb-6">
        <Badge className="border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">
          <Wallet className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Identity
        </Badge>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Link Your Wallet</h1>
        <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
          Connect a wallet to prove ownership for future submissions and votes.
        </p>
      </div>

      <WalletLinker />
    </PageFrame>
  );
}
