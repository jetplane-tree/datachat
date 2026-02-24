import { Dataset } from "@/types";

export const datasets: Dataset[] = [
  {
    id: "ecommerce",
    name: "电商销售数据",
    description:
      "包含订单、商品、客户数据，适合销售趋势分析、品类分析、客户价值分析",
    icon: "ShoppingCart",
    tables: [
      {
        name: "orders",
        description: "订单表",
        rowCount: 5000,
        columns: [
          { name: "order_id", type: "VARCHAR", description: "订单ID", sample: "ORD-20240101-001" },
          { name: "customer_id", type: "VARCHAR", description: "客户ID", sample: "CUST-001" },
          { name: "product_id", type: "VARCHAR", description: "商品ID", sample: "PROD-001" },
          { name: "order_date", type: "DATE", description: "下单日期", sample: "2024-01-15" },
          { name: "quantity", type: "INTEGER", description: "购买数量", sample: "2" },
          { name: "unit_price", type: "DOUBLE", description: "单价（元）", sample: "299.00" },
          { name: "total_amount", type: "DOUBLE", description: "总金额（元）", sample: "598.00" },
          { name: "category", type: "VARCHAR", description: "商品类目", sample: "数码配件" },
          { name: "region", type: "VARCHAR", description: "地区", sample: "华东" },
          { name: "payment_method", type: "VARCHAR", description: "支付方式", sample: "支付宝" },
        ],
      },
      {
        name: "products",
        description: "商品表",
        rowCount: 200,
        columns: [
          { name: "product_id", type: "VARCHAR", description: "商品ID", sample: "PROD-001" },
          { name: "product_name", type: "VARCHAR", description: "商品名称", sample: "无线蓝牙耳机" },
          { name: "category", type: "VARCHAR", description: "类目", sample: "数码配件" },
          { name: "brand", type: "VARCHAR", description: "品牌", sample: "索尼" },
          { name: "cost_price", type: "DOUBLE", description: "成本价", sample: "150.00" },
          { name: "list_price", type: "DOUBLE", description: "标价", sample: "299.00" },
        ],
      },
      {
        name: "customers",
        description: "客户表",
        rowCount: 1000,
        columns: [
          { name: "customer_id", type: "VARCHAR", description: "客户ID", sample: "CUST-001" },
          { name: "customer_name", type: "VARCHAR", description: "客户名称", sample: "张三" },
          { name: "gender", type: "VARCHAR", description: "性别", sample: "男" },
          { name: "age_group", type: "VARCHAR", description: "年龄段", sample: "25-34" },
          { name: "city", type: "VARCHAR", description: "城市", sample: "上海" },
          { name: "register_date", type: "DATE", description: "注册日期", sample: "2023-06-15" },
          { name: "membership", type: "VARCHAR", description: "会员等级", sample: "金卡" },
        ],
      },
    ],
    presetQuestions: [
      "各月销售额趋势是怎样的？",
      "哪个商品类目的销售额最高？",
      "各地区的销售额对比如何？",
      "不同支付方式的使用占比是多少？",
      "客单价最高的前10个客户是谁？",
    ],
    dataFiles: {
      orders: "/data/ecommerce/orders.parquet",
      products: "/data/ecommerce/products.parquet",
      customers: "/data/ecommerce/customers.parquet",
    },
  },
  {
    id: "user-behavior",
    name: "用户行为数据",
    description:
      "包含用户注册、行为事件、会话数据，适合留存分析、转化漏斗、活跃趋势",
    icon: "Users",
    tables: [
      {
        name: "users",
        description: "用户表",
        rowCount: 2000,
        columns: [
          { name: "user_id", type: "VARCHAR", description: "用户ID", sample: "U-10001" },
          { name: "register_date", type: "DATE", description: "注册日期", sample: "2024-01-05" },
          { name: "register_channel", type: "VARCHAR", description: "注册渠道", sample: "微信" },
          { name: "device_type", type: "VARCHAR", description: "设备类型", sample: "iOS" },
          { name: "city", type: "VARCHAR", description: "城市", sample: "北京" },
        ],
      },
      {
        name: "events",
        description: "用户行为事件表",
        rowCount: 50000,
        columns: [
          { name: "event_id", type: "VARCHAR", description: "事件ID", sample: "EVT-00001" },
          { name: "user_id", type: "VARCHAR", description: "用户ID", sample: "U-10001" },
          { name: "event_type", type: "VARCHAR", description: "事件类型", sample: "page_view" },
          { name: "event_date", type: "DATE", description: "事件日期", sample: "2024-01-05" },
          { name: "page", type: "VARCHAR", description: "页面", sample: "首页" },
          { name: "duration_sec", type: "INTEGER", description: "停留时长（秒）", sample: "45" },
        ],
      },
      {
        name: "sessions",
        description: "会话表",
        rowCount: 15000,
        columns: [
          { name: "session_id", type: "VARCHAR", description: "会话ID", sample: "SES-00001" },
          { name: "user_id", type: "VARCHAR", description: "用户ID", sample: "U-10001" },
          { name: "session_date", type: "DATE", description: "会话日期", sample: "2024-01-05" },
          { name: "session_duration", type: "INTEGER", description: "会话时长（秒）", sample: "320" },
          { name: "page_count", type: "INTEGER", description: "浏览页数", sample: "8" },
          { name: "has_conversion", type: "BOOLEAN", description: "是否转化", sample: "true" },
        ],
      },
    ],
    presetQuestions: [
      "每日活跃用户数（DAU）趋势如何？",
      "用户注册后7日留存率是多少？",
      "各注册渠道的用户数量对比？",
      "页面浏览的转化漏斗是怎样的？",
      "iOS和Android用户的行为有什么差异？",
    ],
    dataFiles: {
      users: "/data/user-behavior/users.parquet",
      events: "/data/user-behavior/events.parquet",
      sessions: "/data/user-behavior/sessions.parquet",
    },
  },
  {
    id: "marketing",
    name: "营销活动数据",
    description:
      "包含营销活动、投放渠道、转化数据，适合ROI分析、渠道对比、归因分析",
    icon: "Megaphone",
    tables: [
      {
        name: "campaigns",
        description: "营销活动表",
        rowCount: 100,
        columns: [
          { name: "campaign_id", type: "VARCHAR", description: "活动ID", sample: "CMP-001" },
          { name: "campaign_name", type: "VARCHAR", description: "活动名称", sample: "春节大促" },
          { name: "start_date", type: "DATE", description: "开始日期", sample: "2024-01-20" },
          { name: "end_date", type: "DATE", description: "结束日期", sample: "2024-02-10" },
          { name: "budget", type: "DOUBLE", description: "预算（元）", sample: "50000.00" },
          { name: "campaign_type", type: "VARCHAR", description: "活动类型", sample: "促销" },
        ],
      },
      {
        name: "channels",
        description: "投放渠道表",
        rowCount: 500,
        columns: [
          { name: "channel_id", type: "VARCHAR", description: "渠道记录ID", sample: "CH-001" },
          { name: "campaign_id", type: "VARCHAR", description: "活动ID", sample: "CMP-001" },
          { name: "channel_name", type: "VARCHAR", description: "渠道名称", sample: "抖音" },
          { name: "spend", type: "DOUBLE", description: "花费（元）", sample: "12000.00" },
          { name: "impressions", type: "INTEGER", description: "曝光量", sample: "500000" },
          { name: "clicks", type: "INTEGER", description: "点击量", sample: "15000" },
          { name: "report_date", type: "DATE", description: "报告日期", sample: "2024-01-25" },
        ],
      },
      {
        name: "conversions",
        description: "转化数据表",
        rowCount: 3000,
        columns: [
          { name: "conversion_id", type: "VARCHAR", description: "转化ID", sample: "CONV-001" },
          { name: "campaign_id", type: "VARCHAR", description: "活动ID", sample: "CMP-001" },
          { name: "channel_name", type: "VARCHAR", description: "渠道名称", sample: "抖音" },
          { name: "conversion_date", type: "DATE", description: "转化日期", sample: "2024-01-26" },
          { name: "conversion_type", type: "VARCHAR", description: "转化类型", sample: "下单" },
          { name: "revenue", type: "DOUBLE", description: "转化金额（元）", sample: "399.00" },
        ],
      },
    ],
    presetQuestions: [
      "各营销活动的ROI（投入产出比）排名？",
      "哪个投放渠道的转化率最高？",
      "各渠道的花费与转化金额对比？",
      "春节大促期间每日的转化趋势？",
      "不同活动类型的平均获客成本是多少？",
    ],
    dataFiles: {
      campaigns: "/data/marketing/campaigns.parquet",
      channels: "/data/marketing/channels.parquet",
      conversions: "/data/marketing/conversions.parquet",
    },
  },
];

export function getDatasetById(id: string): Dataset | undefined {
  return datasets.find((d) => d.id === id);
}

export function getSchemaPrompt(dataset: Dataset): string {
  let prompt = `数据集: ${dataset.name}\n\n`;
  for (const table of dataset.tables) {
    prompt += `表名: ${table.name} (${table.description}, 约${table.rowCount}行)\n`;
    prompt += `字段:\n`;
    for (const col of table.columns) {
      prompt += `  - ${col.name} (${col.type}): ${col.description}, 示例: ${col.sample}\n`;
    }
    prompt += `\n`;
  }
  return prompt;
}
