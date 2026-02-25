/**
 * Seed Turso Database with Demo Datasets for DataChat
 *
 * Generates 3 realistic Chinese business demo datasets and inserts them
 * into Turso SQLite tables:
 * 1. Ecommerce (电商销售) - orders, products, customers
 * 2. User Behavior (用户行为) - users, events, sessions
 * 3. Marketing (营销活动) - campaigns, channels, conversions
 *
 * Uses seeded PRNG for reproducibility (identical to generate-datasets.ts).
 *
 * Run: npm run seed-turso
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";

// =============================================================================
// Turso Client
// =============================================================================

function getTursoClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL environment variable is not set");
  }

  return createClient({
    url,
    authToken: authToken || undefined,
  });
}

// =============================================================================
// Seeded Random Number Generator (Mulberry32)
// =============================================================================

function createRNG(seed: number) {
  let s = seed | 0;
  return {
    /** Returns float in [0, 1) */
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Returns integer in [min, max] inclusive */
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    /** Pick random element from array */
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    /** Pick with weighted probabilities (weights don't need to sum to 1) */
    pickWeighted<T>(items: T[], weights: number[]): T {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = this.next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    /** Normal distribution approximation using Box-Muller */
    normal(mean: number, stddev: number): number {
      const u1 = this.next();
      const u2 = this.next();
      const z =
        Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
      return mean + z * stddev;
    },
    /** Shuffle array in place */
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

// =============================================================================
// Date Utilities
// =============================================================================

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function randomDate(
  rng: ReturnType<typeof createRNG>,
  startYear: number,
  startMonth: number,
  startDay: number,
  endYear: number,
  endMonth: number,
  endDay: number
): string {
  const start = new Date(startYear, startMonth - 1, startDay).getTime();
  const end = new Date(endYear, endMonth - 1, endDay).getTime();
  const t = start + rng.next() * (end - start);
  const d = new Date(t);
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Generate a date in 2024 with monthly weights for seasonal distribution */
function weightedDate2024(
  rng: ReturnType<typeof createRNG>,
  monthWeights: number[]
): string {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const month = rng.pickWeighted(months, monthWeights);
  const maxDay = daysInMonth(2024, month);
  const day = rng.int(1, maxDay);
  return dateStr(2024, month, day);
}

function dateBefore(dateA: string, dateB: string): boolean {
  return dateA <= dateB;
}

// =============================================================================
// Chinese Data Constants
// =============================================================================

const SURNAMES = [
  "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
  "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
  "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
  "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕",
];

const MALE_NAMES = [
  "伟", "强", "磊", "军", "勇", "杰", "涛", "明", "超", "华",
  "建国", "建军", "志强", "志明", "文博", "天佑", "俊杰", "浩然",
  "子轩", "梓睿", "宇航", "泽宇", "晨阳", "一鸣", "思远", "嘉诚",
];

const FEMALE_NAMES = [
  "芳", "娜", "秀英", "敏", "静", "丽", "燕", "霞", "玲", "桂英",
  "婷婷", "雪梅", "晓丽", "美玲", "淑芬", "思琪", "欣怡", "雨萱",
  "梓涵", "诗涵", "一诺", "艺涵", "可馨", "语嫣", "心怡", "佳琪",
];

const CITIES = [
  "上海", "北京", "广州", "深圳", "杭州", "南京", "成都", "武汉",
  "重庆", "苏州", "天津", "西安", "长沙", "郑州", "东莞", "青岛",
  "沈阳", "宁波", "昆明", "大连", "厦门", "合肥", "佛山", "福州",
  "哈尔滨", "济南", "温州", "无锡", "南宁", "石家庄",
];

const CITY_REGION_MAP: Record<string, string> = {
  上海: "华东", 北京: "华北", 广州: "华南", 深圳: "华南",
  杭州: "华东", 南京: "华东", 成都: "西南", 武汉: "华中",
  重庆: "西南", 苏州: "华东", 天津: "华北", 西安: "华中",
  长沙: "华中", 郑州: "华中", 东莞: "华南", 青岛: "华东",
  沈阳: "华北", 宁波: "华东", 昆明: "西南", 大连: "华北",
  厦门: "华东", 合肥: "华东", 佛山: "华南", 福州: "华东",
  哈尔滨: "华北", 济南: "华东", 温州: "华东", 无锡: "华东",
  南宁: "华南", 石家庄: "华北",
};

const REGIONS = ["华东", "华南", "华北", "华中", "西南"];
const REGION_WEIGHTS = [35, 20, 20, 15, 10];

const CATEGORIES = [
  "数码配件", "服饰鞋包", "美妆护肤", "食品饮料",
  "家居日用", "运动户外", "图书文具", "母婴用品",
];
const CATEGORY_WEIGHTS = [20, 25, 13, 12, 15, 5, 5, 5];

const PAYMENT_METHODS = ["支付宝", "微信支付", "银行卡", "花呗"];
const PAYMENT_WEIGHTS = [35, 40, 15, 10];

const MEMBERSHIP_LEVELS = ["普通", "银卡", "金卡", "钻石"];
const MEMBERSHIP_WEIGHTS = [50, 25, 15, 10];

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const AGE_GROUP_WEIGHTS = [15, 35, 25, 15, 10];

const GENDERS = ["男", "女"];

const ECOMMERCE_MONTH_WEIGHTS = [
  6,  // Jan - post New Year
  4,  // Feb - Chinese New Year lull
  7,  // Mar - spring
  7,  // Apr
  8,  // May - 5.1 holiday
  10, // Jun - 6.18 promotion
  7,  // Jul
  7,  // Aug - back to school
  8,  // Sep
  9,  // Oct - National Day
  18, // Nov - Double 11
  14, // Dec - Double 12
];

// =============================================================================
// Product Data
// =============================================================================

interface ProductDef {
  category: string;
  names: string[];
  brands: string[];
  priceRange: [number, number];
  markup: [number, number];
}

const PRODUCT_DEFS: ProductDef[] = [
  {
    category: "数码配件",
    names: [
      "蓝牙耳机", "手机壳", "充电宝", "数据线", "手机支架",
      "无线充电器", "蓝牙音箱", "手机膜", "USB集线器", "鼠标垫",
      "机械键盘", "无线鼠标", "摄像头", "平板支架", "电脑包",
      "移动硬盘", "读卡器", "转接头", "智能手环", "屏幕清洁套装",
      "Type-C扩展坞", "游戏手柄", "降噪耳机", "手写板", "投影仪支架",
    ],
    brands: ["品胜", "绿联", "倍思", "安克", "小米", "华为", "罗技", "雷蛇"],
    priceRange: [15, 200],
    markup: [1.5, 3.0],
  },
  {
    category: "服饰鞋包",
    names: [
      "纯棉T恤", "牛仔裤", "连衣裙", "运动鞋", "棒球帽",
      "羽绒服", "风衣", "卫衣", "休闲裤", "衬衫",
      "夹克", "针织衫", "半身裙", "短裤", "西装外套",
      "运动套装", "睡衣套装", "羊毛围巾", "皮带", "袜子礼盒",
      "毛呢大衣", "棉麻衬衫", "百褶裙", "牛仔外套", "运动背心",
    ],
    brands: ["优衣库", "海澜之家", "太平鸟", "李宁", "安踏", "波司登", "森马", "以纯"],
    priceRange: [30, 500],
    markup: [1.8, 4.0],
  },
  {
    category: "美妆护肤",
    names: [
      "面膜", "洗面奶", "保湿霜", "防晒霜", "口红",
      "粉底液", "眼影盘", "卸妆水", "精华液", "爽肤水",
      "身体乳", "护手霜", "香水", "眉笔", "睫毛膏",
      "气垫BB霜", "散粉", "唇釉", "化妆刷套装", "美妆蛋",
      "洁面仪", "面部精油", "眼霜", "颈霜", "面膜仪",
    ],
    brands: ["完美日记", "花西子", "珀莱雅", "薇诺娜", "欧莱雅", "兰蔻", "SK-II", "资生堂"],
    priceRange: [20, 300],
    markup: [2.0, 5.0],
  },
  {
    category: "食品饮料",
    names: [
      "坚果礼盒", "巧克力", "饼干", "牛肉干", "绿茶",
      "咖啡豆", "蜂蜜", "麦片", "果汁", "矿泉水",
      "方便面", "酱油", "食用油", "大米", "零食大礼包",
      "即饮咖啡", "蛋白棒", "果干混合", "奶酪", "酸奶",
      "辣条", "薯片", "海苔", "红枣", "枸杞",
    ],
    brands: ["三只松鼠", "百草味", "良品铺子", "农夫山泉", "蒙牛", "伊利", "旺旺", "统一"],
    priceRange: [5, 80],
    markup: [1.3, 2.5],
  },
  {
    category: "家居日用",
    names: [
      "收纳盒", "毛巾套装", "垃圾桶", "衣架", "枕头",
      "被子", "床单", "台灯", "花瓶", "保温杯",
      "厨房置物架", "调味罐套装", "拖把", "洗碗海绵", "密封罐",
      "桌布", "地毯", "窗帘", "香薰蜡烛", "钟表",
      "抱枕", "沙发垫", "浴室防滑垫", "晾衣架", "鞋架",
    ],
    brands: ["无印良品", "宜家", "网易严选", "京造", "小米", "苏泊尔", "美的", "九阳"],
    priceRange: [10, 300],
    markup: [1.6, 3.5],
  },
  {
    category: "运动户外",
    names: [
      "瑜伽垫", "跳绳", "哑铃", "运动水壶", "护膝",
      "运动手套", "登山杖", "帐篷", "睡袋", "冲锋衣",
      "泳镜", "篮球", "足球", "羽毛球拍", "乒乓球拍",
      "健身弹力带", "拉力器", "运动护腕", "速干毛巾", "运动腰包",
      "骑行头盔", "滑板", "飞盘", "拳击手套", "计步器",
    ],
    brands: ["李宁", "安踏", "迪卡侬", "耐克", "阿迪达斯", "匹克", "特步", "鸿星尔克"],
    priceRange: [15, 400],
    markup: [1.5, 3.0],
  },
  {
    category: "图书文具",
    names: [
      "笔记本", "中性笔", "彩色马克笔", "文件夹", "计算器",
      "便利贴", "书签", "手账本", "钢笔", "橡皮擦",
      "小说", "教材辅导", "绘本", "工具书", "考试真题",
      "文具套装", "桌面收纳", "书立", "名片夹", "白板",
      "画材套装", "日历", "胶带", "印章", "明信片",
    ],
    brands: ["晨光", "得力", "百乐", "斑马", "三菱", "国誉", "当当", "新华书店"],
    priceRange: [3, 60],
    markup: [1.5, 3.0],
  },
  {
    category: "母婴用品",
    names: [
      "婴儿纸尿裤", "奶瓶", "婴儿车", "安全座椅", "婴儿服",
      "玩具积木", "爬行垫", "婴儿洗衣液", "湿巾", "辅食料理机",
      "婴儿浴盆", "温奶器", "吸奶器", "婴儿监护器", "防撞角",
      "儿童牙刷", "学习杯", "安抚奶嘴", "磨牙棒", "婴儿枕",
      "背带", "儿童书包", "画板", "益智玩具", "儿童水杯",
    ],
    brands: ["巴拉巴拉", "好孩子", "贝亲", "帮宝适", "花王", "babycare", "可优比", "全棉时代"],
    priceRange: [20, 500],
    markup: [1.4, 3.0],
  },
];

// =============================================================================
// SQL Helpers
// =============================================================================

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  // Escape single quotes by doubling them
  return `'${String(val).replace(/'/g, "''")}'`;
}

// =============================================================================
// Dataset 1: Ecommerce (电商销售)
// =============================================================================

interface Product {
  product_id: string;
  product_name: string;
  category: string;
  brand: string;
  cost_price: number;
  list_price: number;
}

interface Customer {
  customer_id: string;
  customer_name: string;
  gender: string;
  age_group: string;
  city: string;
  register_date: string;
  membership: string;
}

interface Order {
  order_id: string;
  customer_id: string;
  product_id: string;
  order_date: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  category: string;
  region: string;
  payment_method: string;
}

function generateEcommerceData() {
  console.log("\n=== Generating Ecommerce Dataset ===");
  const rng = createRNG(42);

  // --- Products (~200 rows) ---
  const products: Product[] = [];
  let productIdx = 1;
  for (const def of PRODUCT_DEFS) {
    const count = 25;
    for (let i = 0; i < count; i++) {
      const name = def.names[i % def.names.length];
      const brand = rng.pick(def.brands);
      const costPrice =
        Math.round(
          (def.priceRange[0] +
            rng.next() * (def.priceRange[1] - def.priceRange[0])) *
            100
        ) / 100;
      const markup =
        def.markup[0] + rng.next() * (def.markup[1] - def.markup[0]);
      const listPrice = Math.round(costPrice * markup * 100) / 100;

      products.push({
        product_id: `PROD-${String(productIdx).padStart(3, "0")}`,
        product_name: `${brand}${name}`,
        category: def.category,
        brand,
        cost_price: costPrice,
        list_price: listPrice,
      });
      productIdx++;
    }
  }

  // --- Customers (~1000 rows) ---
  const customers: Customer[] = [];
  for (let i = 1; i <= 1000; i++) {
    const gender = rng.pick(GENDERS);
    const surname = rng.pick(SURNAMES);
    const givenName =
      gender === "男" ? rng.pick(MALE_NAMES) : rng.pick(FEMALE_NAMES);
    const city = rng.pick(CITIES);
    const registerDate = randomDate(rng, 2022, 1, 1, 2024, 10, 31);
    const membership = rng.pickWeighted(MEMBERSHIP_LEVELS, MEMBERSHIP_WEIGHTS);
    const ageGroup = rng.pickWeighted(AGE_GROUPS, AGE_GROUP_WEIGHTS);

    customers.push({
      customer_id: `CUST-${String(i).padStart(4, "0")}`,
      customer_name: `${surname}${givenName}`,
      gender,
      age_group: ageGroup,
      city,
      register_date: registerDate,
      membership,
    });
  }

  // --- Orders (~5000 rows) ---
  const orders: Order[] = [];
  for (let i = 1; i <= 5000; i++) {
    const orderDate = weightedDate2024(rng, ECOMMERCE_MONTH_WEIGHTS);

    // Pick a customer whose register_date is before the order_date
    let customer = rng.pick(customers);
    let attempts = 0;
    while (!dateBefore(customer.register_date, orderDate) && attempts < 20) {
      customer = rng.pick(customers);
      attempts++;
    }
    if (!dateBefore(customer.register_date, orderDate)) {
      customer = customers[rng.int(0, 99)];
    }

    // Pick product with weighted category distribution
    const selectedCategory = rng.pickWeighted(CATEGORIES, CATEGORY_WEIGHTS);
    const categoryProducts = products.filter(
      (p) => p.category === selectedCategory
    );
    const product = rng.pick(categoryProducts);
    const quantity = rng.pickWeighted([1, 2, 3, 4, 5], [40, 30, 15, 10, 5]);
    const unitPrice = product.list_price;
    const totalAmount = Math.round(quantity * unitPrice * 100) / 100;

    const region =
      CITY_REGION_MAP[customer.city] ||
      rng.pickWeighted(REGIONS, REGION_WEIGHTS);
    const paymentMethod = rng.pickWeighted(PAYMENT_METHODS, PAYMENT_WEIGHTS);

    const monthStr = orderDate.slice(5, 7);
    const dayStr = orderDate.slice(8, 10);
    const orderId = `ORD-2024${monthStr}${dayStr}-${String(i).padStart(4, "0")}`;

    orders.push({
      order_id: orderId,
      customer_id: customer.customer_id,
      product_id: product.product_id,
      order_date: orderDate,
      quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      category: product.category,
      region,
      payment_method: paymentMethod,
    });
  }

  return { products, customers, orders };
}

// =============================================================================
// Dataset 2: User Behavior (用户行为)
// =============================================================================

interface User {
  user_id: string;
  register_date: string;
  register_channel: string;
  device_type: string;
  city: string;
}

interface UserEvent {
  event_id: string;
  user_id: string;
  event_type: string;
  event_date: string;
  page: string;
  duration_sec: number;
}

interface Session {
  session_id: string;
  user_id: string;
  session_date: string;
  session_duration: number;
  page_count: number;
  has_conversion: boolean;
}

function generateUserBehaviorData() {
  console.log("\n=== Generating User Behavior Dataset ===");
  const rng = createRNG(123);

  const REGISTER_CHANNELS = ["微信", "抖音", "应用商店", "朋友推荐", "广告"];
  const CHANNEL_WEIGHTS = [30, 25, 20, 15, 10];
  const DEVICE_TYPES = ["iOS", "Android", "Web"];
  const DEVICE_WEIGHTS = [30, 50, 20];

  const EVENT_TYPES = [
    "page_view",
    "click",
    "add_to_cart",
    "purchase",
    "search",
  ];
  const EVENT_WEIGHTS = [40, 25, 15, 12, 8];

  const PAGES = ["首页", "商品详情", "购物车", "搜索结果", "个人中心", "活动页"];
  const PAGE_WEIGHTS = [25, 30, 10, 15, 12, 8];

  const EVENT_MONTH_WEIGHTS = [7, 5, 8, 8, 9, 12, 8, 9, 9, 10, 15, 10];

  // --- Users (~2000 rows) ---
  const users: User[] = [];
  for (let i = 1; i <= 2000; i++) {
    users.push({
      user_id: `U-${String(i).padStart(5, "0")}`,
      register_date: randomDate(rng, 2023, 1, 1, 2024, 11, 30),
      register_channel: rng.pickWeighted(REGISTER_CHANNELS, CHANNEL_WEIGHTS),
      device_type: rng.pickWeighted(DEVICE_TYPES, DEVICE_WEIGHTS),
      city: rng.pick(CITIES),
    });
  }

  // --- Events (~50000 rows) with realistic retention decay ---
  const events: UserEvent[] = [];

  for (let i = 1; i <= 50000; i++) {
    const user = rng.pick(users);
    let eventDate = weightedDate2024(rng, EVENT_MONTH_WEIGHTS);

    // Ensure event is after user registration
    if (!dateBefore(user.register_date, eventDate)) {
      const regYear = parseInt(user.register_date.slice(0, 4));
      const regMonth = parseInt(user.register_date.slice(5, 7));
      const regDay = parseInt(user.register_date.slice(8, 10));
      eventDate = randomDate(
        rng,
        regYear,
        regMonth,
        Math.min(regDay + 1, 28),
        2024,
        12,
        31
      );
    }

    const eventType = rng.pickWeighted(EVENT_TYPES, EVENT_WEIGHTS);
    const page = rng.pickWeighted(PAGES, PAGE_WEIGHTS);

    let durationBase: number;
    switch (eventType) {
      case "page_view":
        durationBase = 15;
        break;
      case "click":
        durationBase = 5;
        break;
      case "add_to_cart":
        durationBase = 25;
        break;
      case "purchase":
        durationBase = 60;
        break;
      case "search":
        durationBase = 12;
        break;
      default:
        durationBase = 10;
    }
    const durationSec = Math.max(
      1,
      Math.round(rng.normal(durationBase, durationBase * 0.4))
    );

    events.push({
      event_id: `EVT-${String(i).padStart(6, "0")}`,
      user_id: user.user_id,
      event_type: eventType,
      event_date: eventDate,
      page,
      duration_sec: durationSec,
    });
  }

  // --- Sessions (~15000 rows) ---
  const sessions: Session[] = [];
  for (let i = 1; i <= 15000; i++) {
    const user = rng.pick(users);
    let sessionDate = weightedDate2024(rng, EVENT_MONTH_WEIGHTS);

    if (!dateBefore(user.register_date, sessionDate)) {
      const regYear = parseInt(user.register_date.slice(0, 4));
      const regMonth = parseInt(user.register_date.slice(5, 7));
      const regDay = parseInt(user.register_date.slice(8, 10));
      sessionDate = randomDate(
        rng,
        regYear,
        regMonth,
        Math.min(regDay + 1, 28),
        2024,
        12,
        31
      );
    }

    const pageCount = rng.pickWeighted(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [5, 10, 15, 18, 15, 12, 8, 6, 4, 3, 2, 2]
    );
    const sessionDuration = Math.max(
      10,
      Math.round(pageCount * rng.normal(45, 20) + rng.normal(30, 15))
    );

    const conversionThreshold =
      pageCount >= 4 ? 0.15 : pageCount >= 2 ? 0.08 : 0.02;
    const hasConversion = rng.next() < conversionThreshold;

    sessions.push({
      session_id: `SES-${String(i).padStart(6, "0")}`,
      user_id: user.user_id,
      session_date: sessionDate,
      session_duration: sessionDuration,
      page_count: pageCount,
      has_conversion: hasConversion,
    });
  }

  return { users, events, sessions };
}

// =============================================================================
// Dataset 3: Marketing (营销活动)
// =============================================================================

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  start_date: string;
  end_date: string;
  budget: number;
  campaign_type: string;
}

interface Channel {
  channel_id: string;
  campaign_id: string;
  channel_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  report_date: string;
}

interface Conversion {
  conversion_id: string;
  campaign_id: string;
  channel_name: string;
  conversion_date: string;
  conversion_type: string;
  revenue: number;
}

function generateMarketingData() {
  console.log("\n=== Generating Marketing Dataset ===");
  const rng = createRNG(456);

  const CAMPAIGN_TYPES = ["促销", "品牌", "拉新", "召回", "节日", "日常"];
  const CAMPAIGN_TYPE_WEIGHTS = [25, 15, 20, 10, 20, 10];

  const CHANNEL_NAMES = ["抖音", "微信", "小红书", "百度", "微博"];
  const CHANNEL_SPEND_WEIGHTS = [30, 25, 20, 15, 10];

  const CONVERSION_TYPES = ["注册", "下单", "付款"];
  const CONVERSION_TYPE_WEIGHTS = [40, 35, 25];

  const CAMPAIGN_NAME_TEMPLATES: Record<string, string[]> = {
    促销: [
      "618大促", "双11狂欢节", "双12优惠", "年货节", "春季特卖",
      "夏日清凉节", "秋季新品促销", "周年庆", "限时秒杀", "满减活动",
      "品类日", "超值购", "囤货节", "新品首发优惠", "会员专享",
      "闪购专场", "跨店满减", "买赠活动", "折扣季", "清仓特卖",
    ],
    品牌: [
      "品牌故事系列", "匠心之作", "品质生活", "品牌周年庆", "新品发布会",
      "品牌日", "联名款首发", "品牌形象升级", "用户故事征集", "品牌体验官",
    ],
    拉新: [
      "新用户首单礼", "邀友有礼", "新人专享券", "注册送好礼", "拉新裂变",
      "新客体验价", "新手大礼包", "首次下单减免", "新用户限时优惠", "试用装免费领",
    ],
    召回: [
      "老用户回馈", "久违特惠", "回归礼包", "沉睡唤醒", "专属优惠券",
      "想念你了", "回归有礼", "老友优惠", "重新发现", "VIP召回",
    ],
    节日: [
      "春节年货节", "元宵节活动", "情人节特惠", "妇女节献礼", "清明踏青",
      "五一出行季", "端午节活动", "七夕浪漫季", "中秋团圆礼", "国庆嘉年华",
      "元旦跨年", "圣诞节", "儿童节", "教师节", "感恩节",
    ],
    日常: [
      "每日推荐", "每周精选", "好物分享", "日常上新", "限定折扣",
      "会员日", "积分兑换", "签到有礼", "随机立减", "晚间秒杀",
    ],
  };

  // --- Campaigns (~100 rows) ---
  const campaigns: Campaign[] = [];
  const usedNames = new Set<string>();

  for (let i = 1; i <= 100; i++) {
    const campaignType = rng.pickWeighted(
      CAMPAIGN_TYPES,
      CAMPAIGN_TYPE_WEIGHTS
    );
    const templates = CAMPAIGN_NAME_TEMPLATES[campaignType];

    let campaignName: string;
    do {
      campaignName = rng.pick(templates);
      if (usedNames.has(campaignName)) {
        campaignName = `${campaignName}${rng.int(2, 9)}期`;
      }
    } while (usedNames.has(campaignName));
    usedNames.add(campaignName);

    const startDate = randomDate(rng, 2024, 1, 1, 2024, 11, 30);
    const durationDays = rng.int(3, 45);
    const startD = new Date(startDate);
    const endD = new Date(startD.getTime() + durationDays * 86400000);
    if (endD.getFullYear() > 2024) {
      endD.setFullYear(2024);
      endD.setMonth(11);
      endD.setDate(31);
    }
    const endDate = dateStr(
      endD.getFullYear(),
      endD.getMonth() + 1,
      endD.getDate()
    );

    const budgetBase =
      rng.next() < 0.15
        ? rng.int(200000, 500000)
        : rng.next() < 0.4
          ? rng.int(50000, 200000)
          : rng.int(5000, 50000);

    campaigns.push({
      campaign_id: `CMP-${String(i).padStart(3, "0")}`,
      campaign_name: campaignName,
      start_date: startDate,
      end_date: endDate,
      budget: budgetBase,
      campaign_type: campaignType,
    });
  }

  // --- Channels (~500 rows) ---
  const channels: Channel[] = [];
  let channelIdx = 1;

  for (const campaign of campaigns) {
    const numChannels = rng.int(2, 5);
    const selectedChannels = rng
      .shuffle([...CHANNEL_NAMES])
      .slice(0, numChannels);

    const channelBudgetShares = selectedChannels.map((ch) => {
      return (
        CHANNEL_SPEND_WEIGHTS[CHANNEL_NAMES.indexOf(ch)] + rng.next() * 10
      );
    });
    const totalShare = channelBudgetShares.reduce((a, b) => a + b, 0);

    for (let ci = 0; ci < selectedChannels.length; ci++) {
      const channelName = selectedChannels[ci];
      const channelBudget =
        (channelBudgetShares[ci] / totalShare) * campaign.budget;

      const reportCount = rng.int(1, 3);
      for (let r = 0; r < reportCount; r++) {
        const reportDate = randomDate(
          rng,
          parseInt(campaign.start_date.slice(0, 4)),
          parseInt(campaign.start_date.slice(5, 7)),
          parseInt(campaign.start_date.slice(8, 10)),
          parseInt(campaign.end_date.slice(0, 4)),
          parseInt(campaign.end_date.slice(5, 7)),
          parseInt(campaign.end_date.slice(8, 10))
        );

        const spend =
          Math.round(
            (channelBudget / reportCount) * (0.7 + rng.next() * 0.6) * 100
          ) / 100;

        const cpm = 5 + rng.next() * 45;
        const impressions = Math.round((spend / cpm) * 1000);
        const ctr = 0.005 + rng.next() * 0.045;
        const clicks = Math.max(1, Math.round(impressions * ctr));

        channels.push({
          channel_id: `CH-${String(channelIdx).padStart(4, "0")}`,
          campaign_id: campaign.campaign_id,
          channel_name: channelName,
          spend,
          impressions,
          clicks,
          report_date: reportDate,
        });
        channelIdx++;
      }
    }
  }

  // --- Conversions (~3000 rows) ---
  const conversions: Conversion[] = [];
  let conversionIdx = 1;

  for (const campaign of campaigns) {
    const conversionCount = Math.max(
      5,
      Math.round((campaign.budget / 10000) * rng.normal(6, 2))
    );

    const campaignChannels = channels
      .filter((c) => c.campaign_id === campaign.campaign_id)
      .map((c) => c.channel_name);
    const uniqueChannels = Array.from(new Set(campaignChannels));

    for (let j = 0; j < conversionCount && conversionIdx <= 3000; j++) {
      const channelName = rng.pick(uniqueChannels);
      const conversionDate = randomDate(
        rng,
        parseInt(campaign.start_date.slice(0, 4)),
        parseInt(campaign.start_date.slice(5, 7)),
        parseInt(campaign.start_date.slice(8, 10)),
        parseInt(campaign.end_date.slice(0, 4)),
        parseInt(campaign.end_date.slice(5, 7)),
        parseInt(campaign.end_date.slice(8, 10))
      );

      const conversionType = rng.pickWeighted(
        CONVERSION_TYPES,
        CONVERSION_TYPE_WEIGHTS
      );

      let revenue: number;
      switch (conversionType) {
        case "注册":
          revenue = 0;
          break;
        case "下单":
          revenue = Math.round(rng.normal(150, 80) * 100) / 100;
          revenue = Math.max(10, revenue);
          break;
        case "付款":
          revenue = Math.round(rng.normal(200, 120) * 100) / 100;
          revenue = Math.max(20, revenue);
          break;
        default:
          revenue = 0;
      }

      conversions.push({
        conversion_id: `CONV-${String(conversionIdx).padStart(4, "0")}`,
        campaign_id: campaign.campaign_id,
        channel_name: channelName,
        conversion_date: conversionDate,
        conversion_type: conversionType,
        revenue,
      });
      conversionIdx++;
    }
  }

  return { campaigns, channels, conversions };
}

// =============================================================================
// Batch Insert Helper
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertBatch(
  db: ReturnType<typeof createClient>,
  tableName: string,
  columns: string[],
  rows: any[],
  batchSize: number = 100
): Promise<void> {
  const colNames = columns.map((c) => `"${c}"`).join(", ");

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valueRows = batch
      .map((row) => {
        const vals = columns.map((c) => escapeSQL(row[c]));
        return `(${vals.join(", ")})`;
      })
      .join(", ");

    await db.execute(`INSERT INTO ${tableName} (${colNames}) VALUES ${valueRows}`);
  }

  console.log(`  Inserted ${rows.length} rows into ${tableName}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("DataChat Turso Seed Script");
  console.log("Connecting to Turso...\n");

  const db = getTursoClient();

  // --- Create Tables ---
  console.log("Creating tables...");

  // Ecommerce tables
  await db.execute(`CREATE TABLE IF NOT EXISTS orders (order_id TEXT, customer_id TEXT, product_id TEXT, order_date TEXT, quantity INTEGER, unit_price REAL, total_amount REAL, category TEXT, region TEXT, payment_method TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS products (product_id TEXT, product_name TEXT, category TEXT, brand TEXT, cost_price REAL, list_price REAL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS customers (customer_id TEXT, customer_name TEXT, gender TEXT, age_group TEXT, city TEXT, register_date TEXT, membership TEXT)`);

  // User behavior tables
  await db.execute(`CREATE TABLE IF NOT EXISTS users (user_id TEXT, register_date TEXT, register_channel TEXT, device_type TEXT, city TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS events (event_id TEXT, user_id TEXT, event_type TEXT, event_date TEXT, page TEXT, duration_sec INTEGER)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sessions (session_id TEXT, user_id TEXT, session_date TEXT, session_duration INTEGER, page_count INTEGER, has_conversion INTEGER)`);

  // Marketing tables
  await db.execute(`CREATE TABLE IF NOT EXISTS campaigns (campaign_id TEXT, campaign_name TEXT, start_date TEXT, end_date TEXT, budget REAL, campaign_type TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channels (channel_id TEXT, campaign_id TEXT, channel_name TEXT, spend REAL, impressions INTEGER, clicks INTEGER, report_date TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS conversions (conversion_id TEXT, campaign_id TEXT, channel_name TEXT, conversion_date TEXT, conversion_type TEXT, revenue REAL)`);

  console.log("Tables created.\n");

  // --- Clear existing data ---
  console.log("Clearing existing data...");
  const tables = ["orders", "products", "customers", "users", "events", "sessions", "campaigns", "channels", "conversions"];
  for (const table of tables) {
    await db.execute(`DELETE FROM ${table}`);
  }
  console.log("Existing data cleared.\n");

  // --- Generate and insert Ecommerce data ---
  const ecommerce = generateEcommerceData();

  await insertBatch(db, "products",
    ["product_id", "product_name", "category", "brand", "cost_price", "list_price"],
    ecommerce.products
  );
  await insertBatch(db, "customers",
    ["customer_id", "customer_name", "gender", "age_group", "city", "register_date", "membership"],
    ecommerce.customers
  );
  await insertBatch(db, "orders",
    ["order_id", "customer_id", "product_id", "order_date", "quantity", "unit_price", "total_amount", "category", "region", "payment_method"],
    ecommerce.orders
  );

  // --- Generate and insert User Behavior data ---
  const userBehavior = generateUserBehaviorData();

  await insertBatch(db, "users",
    ["user_id", "register_date", "register_channel", "device_type", "city"],
    userBehavior.users
  );
  await insertBatch(db, "events",
    ["event_id", "user_id", "event_type", "event_date", "page", "duration_sec"],
    userBehavior.events
  );
  await insertBatch(db, "sessions",
    ["session_id", "user_id", "session_date", "session_duration", "page_count", "has_conversion"],
    userBehavior.sessions
  );

  // --- Generate and insert Marketing data ---
  const marketing = generateMarketingData();

  await insertBatch(db, "campaigns",
    ["campaign_id", "campaign_name", "start_date", "end_date", "budget", "campaign_type"],
    marketing.campaigns
  );
  await insertBatch(db, "channels",
    ["channel_id", "campaign_id", "channel_name", "spend", "impressions", "clicks", "report_date"],
    marketing.channels
  );
  await insertBatch(db, "conversions",
    ["conversion_id", "campaign_id", "channel_name", "conversion_date", "conversion_type", "revenue"],
    marketing.conversions
  );

  console.log("\n=== All datasets seeded successfully! ===");
}

main().catch((err) => {
  console.error("Error seeding database:", err);
  process.exit(1);
});
