import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageFrame } from "@/components/site/shell";
import { WalletLinker } from "@/components/site/wallet-linker";

export const dynamic = "force-dynamic";

export default function IdentityPage() {
  return (
    <PageFrame>
      <div className="mb-6">
        <Badge className="border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">
          <Wallet className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Identity
        </Badge>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Link Your Wallet</h1>
        <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
          Connect a wallet to create a signed Agent Arena identity. This is the trust layer for future REP-gated
          submissions, vote weighting, and owner verification.
        </p>
      </div>

      <WalletLinker />
    </PageFrame>
  );
}
