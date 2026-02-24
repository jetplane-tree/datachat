// Refined chart palette — indigo-teal-amber with warm undertones
export const CHART_COLORS = [
  "#4f46e5", // indigo
  "#0d9488", // teal
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
];

export const chartTheme = {
  color: CHART_COLORS,
  backgroundColor: "transparent",
  textStyle: {
    fontFamily:
      '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#78716c",
    fontSize: 12,
  },
  title: {
    textStyle: {
      fontSize: 14,
      fontWeight: 600,
      color: "#1c1917",
    },
    subtextStyle: {
      fontSize: 12,
      color: "#78716c",
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
      lineStyle: { color: "#e7e5e4" },
    },
    axisTick: { show: false },
    axisLabel: {
      color: "#78716c",
      fontSize: 11,
    },
    splitLine: { show: false },
  },
  yAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: "#a8a29e",
      fontSize: 11,
    },
    splitLine: {
      lineStyle: {
        color: "#f5f5f4",
        type: "dashed" as const,
      },
    },
  },
  legend: {
    textStyle: {
      color: "#78716c",
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
    borderColor: "#e7e5e4",
    borderWidth: 1,
    textStyle: {
      color: "#1c1917",
      fontSize: 12,
    },
    extraCssText:
      "box-shadow: 0 4px 16px rgba(28,25,23,0.08); border-radius: 10px; padding: 10px 14px;",
  },
};
