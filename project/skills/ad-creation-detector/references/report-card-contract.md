# 报告卡片数据契约 — `report_card.cjs` 输入输出 schema

> **本文档是什么:** 日常需求检测 检测后调用 `project/ad-creation-detector/scripts/report_card.cjs` 渲染飞书原生卡片时的**数据契约**(输入 schema / 卡片颜色规则 / chat_id 来源 / 调用方式)。
> **本文档不是什么:** 不装 `report_card.cjs` 内部实现(那是 cjs 代码,工程不动);不装飞书 SDK 调用(由 `capability:feishu_native_card.*` 路由);不装具体业务卡片视觉(那 lock 在 [SKILL.md "卡片结构" 段](../SKILL.md))。
> **关联指向:** 日常需求检测 检测流程见 [SKILL.md](../SKILL.md);cron 注册 SOP 见 [cron-registration.md](cron-registration.md);卡片视觉模板锁在 SKILL.md。

---

## 输入 schema(传给 `sendMultiProjectReport(projectReports, chat_id)`)

`projectReports` 是一个数组,每个元素是一个 instance(项目)。

```json
[
  {
    "project_id": "<instance_id>",
    "country": "<Country (CC)>",
    "flag": "<emoji 国旗>",
    "account_name": "<Account_Name>",
    "products": [
      {
        "name": "<group_value>",
        "tab_name": "<Detection_Tab_Name>",
        "stats": {
          "done": 0,
          "link": 0,
          "pending": 0,
          "cancel": 0
        },
        "new_items": [
          {
            "date": "<MM-DD>",
            "content": "<素材描述>",
            "budget": "<USD 金额或字符串>",
            "link": "<facebook 链接 URL>"
          }
        ]
      }
    ]
  }
]
```

### 字段语义与来源

| 字段 | 类型 | 来源 | 必填 |
|---|---|---|---|
| `project_id` | string | `instance.yaml.instance_id` | ✅ |
| `country` | string | 由 `instance.yaml.identity.country_code` 解析为可读国家名 + ISO 简写 | ✅ |
| `flag` | string(emoji) | 国家 emoji 国旗(如 🇸🇬🇯🇵🇬🇧),agent 按 country_code 对应 | ✅ |
| `account_name` | string | `instance.yaml.identity.account_name` | ✅ |
| `products` | array | 该 instance 下每个 group 一项 | ✅ (可为空数组) |
| `products[i].name` | string | `instance.yaml.group_dimension.values[i]`(即 group 名) | ✅ |
| `products[i].tab_name` | string | `groups/{group}/group.yaml.detection.sheet.tab_name` | ✅ |
| `products[i].stats` | object | 运行时检测产生(本次 sheet 状态统计) | ✅ |
| `products[i].stats.done` | int | 已完成数量(已在 Meta 后台匹配到) | ✅ |
| `products[i].stats.link` | int | 表格 Link 已填且 Meta 后台匹配中数量 | ✅ |
| `products[i].stats.pending` | int | 待补字段数量(如缺 Link / 缺 Budget) | ✅ |
| `products[i].stats.cancel` | int | 表格中标 cancel/Cancal 等数量 | ✅ |
| `products[i].new_items` | array | 本次新增明细;空数组表示无新增 | ✅ (可为空) |
| `new_items[j].date` | string `MM-DD` | sheet 当前行的日期列 | ✅ |
| `new_items[j].content` | string | 素材描述(从 sheet 该行解析) | ✅ |
| `new_items[j].budget` | string | 美元金额或原始字符串 | ✅ |
| `new_items[j].link` | string URL | facebook 链接 | ✅ |

---

## 卡片颜色规则

| 触发条件 | 颜色 | 时间点限制 |
|---|---|---|
| 任意 instance 的任意 group `new_items` 非空 | orange | 全档(10:10 / 15:00 / 18:30 均发) |
| 全部 instance `new_items` 都为空 + 当前为 10:10 或 18:30 | green | 仅 10:10 / 18:30 发卡,15:00 不发 |
| 全部 instance `new_items` 都为空 + 当前为 15:00 | (静默,不发卡) | 仅写日志 |
| 抓取异常(网络失败 / sheet 拒绝访问 / Meta API 异常) | red | 任何时间点都发,等待用户处置 |

> 15:00 静默规则由 `instance.yaml.schedule.rules["15:00"]` 决定。若用户调整 schedule 规则,15:00 行为可改为全档发卡(以 instance.yaml 为准)。

---

## chat_id 来源(每个 instance 独立)

调用 `sendMultiProjectReport(projectReports, chat_id)` 时,`chat_id` 来自:

```
instance.yaml.notification.feishu.chat_id
```

**多 instance 同时存在时的处理:**
- 若所有 instance 的 chat_id 相同 → 一次调用,一张卡片汇总
- 若不同 instance 的 chat_id 不同 → 按 chat_id 分组,每组一次调用,各发各的卡

---

## 调用方式

### CLI 方式(传 JSON)

```bash
node project/ad-creation-detector/scripts/report_card.cjs '<json_array>'
```

无参数时使用默认测试数据(便于联调)。

### 程序化调用

```js
const { sendMultiProjectReport, discoverProjects } = require('./scripts/report_card.cjs');

// 自动发现已配置 instance(需平台运行环境支持 ~/.openclaw/workspace/projects 扫描)
const projects = discoverProjects();

// 按上面 schema 拼装 projectReports(由 agent 完成)
const projectReports = [...];

// 发送
await sendMultiProjectReport(projectReports, '<chat_id>');
```

---

## agent 在日常需求检测 调用前的自检

调用 `report_card.cjs` 前,必须执行 5 项内部自检:

1. `projectReports` 为数组,且每个元素 5 个必填字段全部存在(project_id / country / flag / account_name / products)
2. 每个 product 4 个必填字段全部存在(name / tab_name / stats / new_items)
3. `stats` 4 个 int 字段全部存在(done / link / pending / cancel),无 NaN
4. `new_items` 中每条 4 字段全部存在(date / content / budget / link)
5. `chat_id` 非空(从 instance.yaml.notification.feishu.chat_id 取值)

**任意自检失败时不调用 cjs,先补全数据再发送**。这是 [SKILL.md "收工自检" 节](../SKILL.md) 在日常需求检测 的具体落地。
