import { Header } from "@/components/layout/header";
import { DatasetCard } from "@/components/home/dataset-card";
import { UploadCard } from "@/components/home/upload-card";
import { DuckDBPreloader } from "@/components/duckdb-preloader";
import { datasets } from "@/lib/dataset-registry";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background">
      <DuckDBPreloader />
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[400px] left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-100/40 blur-[120px]" />
        <div className="absolute -top-[200px] right-[10%] h-[400px] w-[400px] rounded-full bg-teal-100/30 blur-[100px]" />
      </div>

      <Header />

      <main className="relative mx-auto max-w-3xl px-6 pb-20 pt-24">
        {/* Hero */}
        <div className="mb-20 text-center animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/80 px-3.5 py-1.5 text-xs text-indigo-600 shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            AI 驱动的数据分析
          </div>
          <h1 className="font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl">
            DataChat
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground text-balance">
            用自然语言和数据对话，AI 自动分析、生成图表、给出洞察
          </p>
        </div>

        {/* Section label */}
        <div className="mb-5 animate-fade-up stagger-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            选择数据集
          </p>
        </div>

        {/* Dataset grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {datasets.map((dataset, i) => (
            <div
              key={dataset.id}
              className="animate-fade-up"
              style={{ animationDelay: `${(i + 2) * 80}ms` }}
            >
              <DatasetCard dataset={dataset} />
            </div>
          ))}
          <div
            className="animate-fade-up"
            style={{ animationDelay: `${(datasets.length + 2) * 80}ms` }}
          >
            <UploadCard />
          </div>
        </div>
      </main>
    </div>
  );
}
