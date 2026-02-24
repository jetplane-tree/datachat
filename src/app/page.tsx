import { Header } from "@/components/layout/header";
import { DatasetCard } from "@/components/home/dataset-card";
import { UploadCard } from "@/components/home/upload-card";
import { datasets } from "@/lib/dataset-registry";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-20">
        {/* Hero */}
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            DataChat
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            用自然语言和数据对话，让数据分析像聊天一样简单
          </p>
        </div>

        {/* Dataset grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {datasets.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
          <UploadCard />
        </div>
      </main>
    </div>
  );
}
