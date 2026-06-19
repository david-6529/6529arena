import { FileText } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { WaveBriefAdmin } from "@/components/admin/wave-brief-admin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { getParam, getWaveBriefRows } from "@/lib/briefs/page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBriefsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialWaveInput = getParam(params, "wave") ?? "";
  const rows = await getWaveBriefRows(50);

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <FileText className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Alpha
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Wave Check-ins</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Pick a 6529 wave, preview what will be read, generate a check-in, then decide what deserves posting or follow-up work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/" variant="secondary">Home</ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <WaveBriefAdmin briefs={rows} initialWaveInput={initialWaveInput} />
    </PageFrame>
  );
}
