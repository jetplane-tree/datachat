import { Dataset } from "@/types";

export const datasets: Dataset[] = [
  {
    id: "ecommerce",
    name: "电商销售数据",
    description:
      "包含订单、商品、客户数据，适合销售趋势分析、品类分析、客户价值分析",
    icon: "ShoppingCart",
    tableNames: ["orders", "products", "customers"],
    presetQuestions: [
      "各月销售额趋势是怎样的？",
      "哪个商品类目的销售额最高？",
      "各地区的销售额对比如何？",
      "不同支付方式的使用占比是多少？",
      "客单价最高的前10个客户是谁？",
    ],
  },
  {
    id: "user-behavior",
    name: "用户行为数据",
    description:
      "包含用户注册、行为事件、会话数据，适合留存分析、转化漏斗、活跃趋势",
    icon: "Users",
    tableNames: ["users", "events", "sessions"],
    presetQuestions: [
      "每日活跃用户数（DAU）趋势如何？",
      "用户注册后7日留存率是多少？",
      "各注册渠道的用户数量对比？",
      "页面浏览的转化漏斗是怎样的？",
      "iOS和Android用户的行为有什么差异？",
    ],
  },
  {
    id: "marketing",
    name: "营销活动数据",
    description:
      "包含营销活动、投放渠道、转化数据，适合ROI分析、渠道对比、归因分析",
    icon: "Megaphone",
    tableNames: ["campaigns", "channels", "conversions"],
    presetQuestions: [
      "各营销活动的ROI（投入产出比）排名？",
      "哪个投放渠道的转化率最高？",
      "各渠道的花费与转化金额对比？",
      "节日类活动期间每日的转化趋势？",
      "不同活动类型的平均获客成本是多少？",
    ],
  },
];

export function getDatasetById(id: string): Dataset | undefined {
  return datasets.find((d) => d.id === id);
}
