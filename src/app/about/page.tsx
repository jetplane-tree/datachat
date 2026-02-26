import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Database,
  BarChart3,
  MessageSquare,
  Code2,
  Github,
  Mail,
  User,
} from "lucide-react";

const techStack = [
  {
    name: "Next.js 15",
    description: "React 全栈框架，支持 App Router 与服务端渲染",
  },
  {
    name: "TypeScript",
    description: "类型安全，提升代码可维护性和开发体验",
  },
  {
    name: "Tailwind CSS",
    description: "原子化 CSS 框架，快速构建一致的 UI",
  },
  {
    name: "shadcn/ui",
    description: "高质量可定制组件库，基于 Radix UI",
  },
  {
    name: "Turso (SQLite)",
    description: "云端 SQLite 数据库，服务端高性能 SQL 查询执行",
  },
  {
    name: "ECharts",
    description: "功能丰富的可视化图表库，支持多种图表类型",
  },
  {
    name: "DeepSeek API",
    description: "大语言模型 API，将自然语言转化为 SQL 查询",
  },
];

const flowSteps = [
  {
    icon: MessageSquare,
    label: "用户提问",
    description: "自然语言输入",
  },
  {
    icon: Code2,
    label: "LLM API",
    description: "理解意图，生成 SQL",
  },
  {
    icon: Database,
    label: "Turso (SQLite)",
    description: "服务端执行 SQL 查询",
  },
  {
    icon: BarChart3,
    label: "ECharts 渲染",
    description: "可视化数据结果",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16">
        {/* Section 1: Project Introduction */}
        <section className="mb-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            关于 DataChat
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            DataChat 是一个 AI
            驱动的数据分析平台，让你可以通过自然语言与数据对话。只需上传数据或选择内置数据集，用日常语言提出问题，系统会自动生成
            SQL 查询、执行分析并以图表形式呈现结果。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              内置 3 个业务数据集
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              支持自定义数据上传
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              服务端 SQL 执行
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              自动图表生成
            </Badge>
          </div>
        </section>

        <Separator className="mb-14" />

        {/* Section 2: Tech Stack */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            技术栈
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            项目使用的核心技术及其选型理由
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {techStack.map((tech) => (
              <Card
                key={tech.name}
                className="border-border/60 p-4 shadow-none"
              >
                <CardContent className="p-0">
                  <p className="text-sm font-medium text-foreground">
                    {tech.name}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {tech.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="mb-14" />

        {/* Section 3: Architecture */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            架构流程
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            从用户提问到数据可视化的完整链路
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-0">
            {flowSteps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-3 sm:gap-0">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-foreground">
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                {index < flowSteps.length - 1 && (
                  <ArrowRight className="mx-4 hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" />
                )}
                {index < flowSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-muted-foreground/50 sm:hidden" />
                )}
              </div>
            ))}
          </div>
        </section>

        <Separator className="mb-14" />

        {/* Section 4: About the Author */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            关于作者
          </h2>
          <Card className="mt-6 border-border/60 p-6 shadow-none">
            <CardContent className="p-0">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Kamook
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    热衷于将数据分析经验与前沿 AI
                    技术结合，构建实用的数据工具产品。DataChat
                    是这一探索过程中的实践项目。
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <a
                      href="mailto:aloiwatermelon@hotmail.com"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      aloiwatermelon@hotmail.com
                    </a>
                    <a
                      href="https://github.com/jetplane-tree/datachat"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Github className="h-3.5 w-3.5" />
                      GitHub
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
