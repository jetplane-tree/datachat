export const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

export const chartTheme = {
  color: CHART_COLORS,
  backgroundColor: "transparent",
  textStyle: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#71717a",
    fontSize: 12,
  },
  title: {
    textStyle: {
      fontSize: 14,
      fontWeight: 600,
      color: "#18181b",
    },
    subtextStyle: {
      fontSize: 12,
      color: "#71717a",
    },
    left: "left",
    padding: [0, 0, 12, 0],
  },
  grid: {
    left: 12,
    right: 24,
    top: 48,
    bottom: 12,
    containLabel: true,
  },
  xAxis: {
    axisLine: {
      show: true,
      lineStyle: { color: "#e4e4e7" },
    },
    axisTick: { show: false },
    axisLabel: {
      color: "#71717a",
      fontSize: 11,
    },
    splitLine: { show: false },
  },
  yAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: "#a1a1aa",
      fontSize: 11,
    },
    splitLine: {
      lineStyle: {
        color: "#f4f4f5",
        type: "dashed" as const,
      },
    },
  },
  legend: {
    textStyle: {
      color: "#71717a",
      fontSize: 11,
    },
    icon: "roundRect",
    itemWidth: 12,
    itemHeight: 8,
    top: 0,
    right: 0,
  },
  tooltip: {
    backgroundColor: "#fff",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    textStyle: {
      color: "#18181b",
      fontSize: 12,
    },
    extraCssText: "box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 8px;",
  },
};
