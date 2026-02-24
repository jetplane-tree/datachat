"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { ChartConfig, QueryResult } from "@/types";
import { CHART_COLORS, chartTheme } from "@/lib/chart-theme";
import { BarChart3 } from "lucide-react";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[340px] items-center justify-center">
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
    </div>
  ),
});

interface ChartRendererProps {
  chartConfig: ChartConfig;
  queryResult: QueryResult;
}

export function ChartRenderer({ chartConfig, queryResult }: ChartRendererProps) {
  const option = useMemo(() => {
    const { type, xField, yField, seriesField, title } = chartConfig;
    const { rows } = queryResult;

    if (!rows || rows.length === 0) return null;

    const baseOption = {
      ...chartTheme,
      title: {
        ...chartTheme.title,
        text: title,
      },
      tooltip: {
        ...chartTheme.tooltip,
        trigger: type === "pie" ? "item" : "axis",
      },
      animation: true,
      animationDuration: 600,
      animationEasing: "cubicOut" as const,
    };

    // Pie chart
    if (type === "pie") {
      const data = rows.map((row, i) => ({
        name: String(row[xField || ""] ?? `类别${i}`),
        value: Number(row[yField || ""] ?? 0),
      }));

      return {
        ...baseOption,
        grid: undefined,
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            center: ["50%", "55%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: "#fff",
              borderWidth: 2,
            },
            label: {
              show: true,
              fontSize: 11,
              color: "#71717a",
              formatter: "{b}: {d}%",
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 13,
                fontWeight: "bold",
              },
            },
            data,
          },
        ],
      };
    }

    // Funnel chart
    if (type === "funnel") {
      const data = rows.map((row, i) => ({
        name: String(row[xField || ""] ?? `步骤${i}`),
        value: Number(row[yField || ""] ?? 0),
      }));

      return {
        ...baseOption,
        grid: undefined,
        series: [
          {
            type: "funnel",
            left: "10%",
            top: 48,
            bottom: 12,
            width: "80%",
            sort: "descending",
            gap: 2,
            label: {
              show: true,
              position: "inside",
              fontSize: 12,
              color: "#fff",
            },
            itemStyle: {
              borderColor: "#fff",
              borderWidth: 1,
            },
            data,
          },
        ],
      };
    }

    // Line, bar, scatter with possible seriesField
    const xValues = xField
      ? [...new Set(rows.map((r) => String(r[xField] ?? "")))]
      : rows.map((_, i) => String(i));

    const needDataZoom = xValues.length > 20;

    if (seriesField) {
      // Multi-series
      const seriesValues = [
        ...new Set(rows.map((r) => String(r[seriesField] ?? ""))),
      ];

      const seriesList = seriesValues.map((sv, idx) => {
        const seriesData = xValues.map((xv) => {
          const matched = rows.find(
            (r) =>
              String(r[xField || ""] ?? "") === xv &&
              String(r[seriesField] ?? "") === sv
          );
          return matched ? Number(matched[yField || ""] ?? 0) : 0;
        });

        return {
          name: sv,
          type: type === "scatter" ? "scatter" : type,
          data: seriesData,
          smooth: type === "line",
          symbolSize: type === "scatter" ? 8 : 4,
          itemStyle: {
            color: CHART_COLORS[idx % CHART_COLORS.length],
          },
          ...(type === "bar"
            ? { barMaxWidth: 32, borderRadius: [3, 3, 0, 0] }
            : {}),
          ...(type === "line"
            ? {
                lineStyle: { width: 2 },
                areaStyle: { opacity: 0.05 },
              }
            : {}),
        };
      });

      return {
        ...baseOption,
        legend: {
          ...chartTheme.legend,
          data: seriesValues,
        },
        xAxis: {
          ...chartTheme.xAxis,
          type: "category",
          data: xValues,
        },
        yAxis: {
          ...chartTheme.yAxis,
          type: "value",
        },
        series: seriesList,
        ...(needDataZoom
          ? {
              dataZoom: [
                {
                  type: "inside",
                  start: 0,
                  end: Math.min(100, (20 / xValues.length) * 100),
                },
                {
                  type: "slider",
                  start: 0,
                  end: Math.min(100, (20 / xValues.length) * 100),
                  height: 20,
                  bottom: 0,
                  borderColor: "#e4e4e7",
                  fillerColor: "rgba(99,102,241,0.08)",
                  handleStyle: { color: "#6366f1" },
                },
              ],
            }
          : {}),
      };
    }

    // Single series
    if (type === "scatter") {
      const data = rows.map((r) => [
        Number(r[xField || ""] ?? 0),
        Number(r[yField || ""] ?? 0),
      ]);

      return {
        ...baseOption,
        xAxis: {
          ...chartTheme.xAxis,
          type: "value",
          name: xField,
        },
        yAxis: {
          ...chartTheme.yAxis,
          type: "value",
          name: yField,
        },
        series: [
          {
            type: "scatter",
            data,
            symbolSize: 8,
            itemStyle: {
              color: CHART_COLORS[0],
              opacity: 0.7,
            },
          },
        ],
      };
    }

    // Default line/bar
    const yValues = rows.map((r) => Number(r[yField || ""] ?? 0));

    return {
      ...baseOption,
      xAxis: {
        ...chartTheme.xAxis,
        type: "category",
        data: xValues,
      },
      yAxis: {
        ...chartTheme.yAxis,
        type: "value",
      },
      series: [
        {
          type,
          data: yValues,
          smooth: type === "line",
          itemStyle: {
            color: CHART_COLORS[0],
          },
          ...(type === "bar"
            ? { barMaxWidth: 40, borderRadius: [4, 4, 0, 0] }
            : {}),
          ...(type === "line"
            ? {
                lineStyle: { width: 2.5 },
                areaStyle: {
                  color: {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: "rgba(99,102,241,0.15)" },
                      { offset: 1, color: "rgba(99,102,241,0.01)" },
                    ],
                  },
                },
                symbol: "circle",
                symbolSize: 5,
              }
            : {}),
        },
      ],
      ...(needDataZoom
        ? {
            dataZoom: [
              {
                type: "inside",
                start: 0,
                end: Math.min(100, (20 / xValues.length) * 100),
              },
              {
                type: "slider",
                start: 0,
                end: Math.min(100, (20 / xValues.length) * 100),
                height: 20,
                bottom: 0,
                borderColor: "#e4e4e7",
                fillerColor: "rgba(99,102,241,0.08)",
                handleStyle: { color: "#6366f1" },
              },
            ],
          }
        : {}),
    };
  }, [chartConfig, queryResult]);

  if (!option) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
          <span className="text-xs">暂无数据</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg">
      <ReactECharts
        option={option}
        style={{ height: 340, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}
