import { WaveBriefAdmin } from "@/components/admin/wave-brief-admin";
import { getWaveBriefProviderConfig } from "@/lib/briefs/runBrief";
import { getParam, getWaveBriefRows } from "@/lib/briefs/page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialWaveInput = getParam(params, "wave") ?? "";
  const providerConfig = getWaveBriefProviderConfig();
  const initialProvider = providerConfig.provider === "local" ? "openai" : providerConfig.provider;
  const rows = await getWaveBriefRows(50);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-950 px-4 pb-12 text-zinc-50 sm:px-6">
      <WaveBriefAdmin briefs={rows} initialWaveInput={initialWaveInput} initialProvider={initialProvider} surface="signal" />
    </main>
  );
}
