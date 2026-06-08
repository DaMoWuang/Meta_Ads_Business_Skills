---
name: meta-ads-sheet-mapping
description: |
  Sheet ↔ Meta 广告后台 字段映射方法论 skill。把 Google Sheet / Media Plan 与 Meta 广告账户做逻辑映射,反推命名规范、解码受众定向、识别预算/素材字段。

  使用场景:
  - 用户提供一份 sheet,需要 agent 识别"哪一列是什么 / 怎么对应到 Meta API 参数"(用户口语如"表格逻辑梳理"/"接入 sheet"/"命名梳理"/"受众解码"/"帮我看下这个表格怎么映射"等任何语义类似请求)
  - 走 ad-creation-detector 项目接入引导 接入新账户时,内部调用本 skill 的方法论(sheet 结构识别 / 命名反推 / 受众解码)
  - 表格新增列 / 命名格式变更 → 需要重新反推映射

  特点:不预设具体答案(命名 segment / tier 名 / 列 index 等都因项目不同而异),agent 走方法论从该项目自己的 sheet + Meta 后台 + 用户确认中习得,落到 instances/{instance}/。

  不用于:Meta API 直接调用(由 `capability:vh_meta_ads.*` 路由);流程编排(去 ad-creation-detector)。
---

# 创编表格逻辑梳理

> **调用前必读 [capability-routing.md](../../capability-routing.md)** — 项目接入引导 的字段映射结论按分层原则沉淀(yaml 锁核心 anchor / notes 收软经验 / 运行时临场判断)落到 `project/instances/{instance}/groups/{group}/group.yaml.strategy.*` 和 `notes/`,本 skill 不写死路径。

> **执行边界:** 本 skill 是方法论 skill,只描述"如何分析 sheet 结构 / 反推命名 / 解码受众",不直接调用 Meta API。任何 Meta 后台数据查询通过 `capability:vh_meta_ads.*`(由 [capability-routing.md](../../capability-routing.md) 路由)执行。

> **自带政策:** 与同包内 [ad-creation-detector/SKILL.md](../ad-creation-detector/SKILL.md) "自带政策"段一致(底层能力调用边界 / Fail Loud / 读写分级 / 不主动延伸 / 形式红线 / 自检归因 / 偏差不重复)。

将 Google Sheet Media Plan 或表格 与 Meta 广告后台进行逻辑映射,帮助用户理解表格字段如何对应广告创建参数,并指引用户完成广告创建。

> ⚠️ **本 skill 描述 agent 怎么去 introspect,不预设任何项目的命名 / 受众 / 默认值答案**。
> 命名规则、受众 tier 列表、投放默认值都由 agent 走 项目接入引导 从 **该项目的** sheet + Meta 后台 + 用户确认中习得,落到 `project/instances/{instance}/...`。
> 想看一个 introspection 完成后的形态参考,接入第一个实例后会落到 `project/instances/{instance}/`(届时该实例**仅作形态参考,不可作为模板复制**)。当前 `project/instances/` 仅有 `_template/`。

## 核心流程

```
1. 获取表格 → 2. 解析结构 → 3. 定位账户 → 4. 映射逻辑 → 5. 输出对应表 → 6. 指引创建
```

## Step 1: 获取表格

用户提供 Google Sheet 链接或上传文件后:

```python
# 通过 gviz API 获取各 sheet 内容
BASE = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}"
```

### 必须获取的 Sheet(按优先级)

| Sheet 类别 | 作用 | 关键字段类型 |
|---|---|---|
| **命名规范 sheet** | 命名拼接公式 | 各 segment 位置与拼接顺序 |
| **受众定义 sheet** | 受众定向逐 tier 描述 | 兴趣、行为、职位、设备、Custom Audience 等 |
| **排期 / Media Plan sheet** | 内容日历 | 日期、素材、预算、投放类型 |
| **实际 campaign 列表 sheet** | 验证用 | 实际命名、预算单位 |

> 上述类别名称是**语义类别**,不是固定 tab 名 — agent 通过 sheet header 探测自动定位,见 `references/sheet-structure-introspection.md`。

### 获取方式

```bash
# CSV 方式获取(推荐)
curl -sL "https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet={encoded_sheet_name}"

# 如果有 gid
curl -sL "https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&gid={GID}"
```

## Step 2: 解析结构

### 2.1 命名规范

不预设任何命名模板。Agent 走 **命名规则反推方法论**:

1. 读命名规范 sheet(如 Campaign name tab),识别 segment 字段及顺序
2. 拉历史 Meta campaign(`/act_*/campaigns?fields=name`)做反向校验
3. 与用户确认 segment 拼接规则、分隔符、必填字段

详细方法论见 `references/naming-introspection-method.md`,落点 `project/instances/{instance}/notes/naming-convention.md` 或 `groups/{group}/group.yaml.strategy.naming_pattern`。

### 2.2 受众定向

不预设 tier 名称(T1_xxx/T2_xxx 完全由项目业务自定义)。Agent 走 **受众解码方法论**:

1. 读受众定义 sheet,逐行解析每个 tier 的语义描述
2. 调 `/act_*/saved_audiences?fields=id,name,targeting` 模糊匹配 tier 名
3. 拉历史 Ad Set targeting 反向印证
4. 与用户确认 tier 列表与每个 tier 的 targeting JSON

字段类别(Meta API 通用,所有项目都一样):

| 表格语义 | Meta API 对应 |
|---|---|
| 兴趣标签 | `flexible_spec[].interests` |
| 行为标签 | `flexible_spec[].behaviors` |
| 职位定向 | `flexible_spec[].work_positions` |
| 雇主定向 | `flexible_spec[].work_employers` |
| 再营销人群包 | `targeting.custom_audiences` |
| 设备定向 | `targeting.user_device`(非标填写,需 AA=ON + Manual Placements 才在 UI 显示) |
| 年龄 | `age_min` / `age_max` |
| 性别 | `genders` |
| 地域 | `geo_locations` |

详细方法论见 `references/audience-introspection-method.md`,落点 `groups/{group}/audiences/{tier}.json` + `groups/{group}/notes/audience-definition.md`。

### 2.3 投放类型判断

根据表格中 KPI / Objective 字段(语义识别)+ 素材类型字段判断:

| 表格语义 | optimization_goal | billing_event | destination_type |
|---|---|---|---|
| video / videoview | THRUPLAY | THRUPLAY | ON_VIDEO |
| post / postengagement | POST_ENGAGEMENT | IMPRESSIONS | ON_POST |
| website / traffic | LINK_CLICKS | LINK_CLICKS | WEBSITE |

**铁则:以表格中 (KPI / Objective) 为准,不参考在跑广告!**

## Step 3: 定位账户

### 自动定位流程

1. 从表格中提取 Brand + Country 信息
2. 通过 vhcli 或 token 文件定位对应广告账户:
   ```python
   # Token 路径
   tokens = json.load(open('~/.vhcli/ad_tokens.json'))
   # 结构: tokens[project_id][account_id]['token']
   ```
3. 验证账户与表格匹配(品牌+国家)
4. 获取 Page ID、Pixel ID 等关联资源

### 关键资源获取

```python
# Page ID
GET /me/accounts → 找到对应品牌+国家的 Page

# Pixel ID
GET /act_{account_id}/adspixels → 获取 pixel

# Saved Audiences
GET /act_{account_id}/saved_audiences?fields=id,name,targeting
```

## Step 4: 映射逻辑

### 4.1 Campaign 层级映射

| 表格字段类别 | Meta Campaign 参数 |
|---|---|
| 素材名 + 日期 + Tier | `name`(按命名规范拼接) |
| KPI / Objective | `objective`(以表格为准,在跑广告配置为辅) |
| Budget 列 | `lifetime_budget` / `daily_budget`(单位:分,$50=5000) |
| 起止日期 | `start_time` / `end_time` |

### 4.2 Ad Set 层级映射

| 表格字段类别 | Meta Ad Set 参数 |
|---|---|
| Tier 分组 | 每个 Tier 一个 Ad Set |
| Audience 定义 | `targeting`(从 saved audience 读取或按表格构建) |
| KPI | `optimization_goal` + `billing_event` |
| Placement | `publisher_platforms` + `positions` |

### 4.3 Ad 层级映射

| 表格字段类别 | Meta Ad 参数 |
|---|---|
| Creative 名 | `name` |
| 素材来源 | `creative.object_story_id` = `{page_id}_{post_id}` |
| Pixel | `tracking_specs` 中的 `fb_pixel` |

## Step 5: 输出映射对应表

完成解析后,输出一份结构化的映射总结(具体字段值由本次 introspection 决定,不预设):

```markdown
## 映射总结

### 命名规范
[本次反推得到的拼接公式 + 该项目的实际示例]

### 受众 Tier 对应
| Tier 名 | Ad Set Name | 定向类型 | 内容 |
|---|---|---|---|
| (本次解码出的 tier 列表) | ... | ... | ... |

### 投放参数
| 素材类型 | optimization_goal | billing_event | destination_type |
|---|---|---|---|

### 预算规则
- 单位、分配方式(CBO/ABO)、生命周期
```

## Step 6: 指引创建

基于映射结果,引导用户确认后执行创建:

1. **确认清单** — 展示将要创建的 Campaign 结构,用户确认
2. **逐步创建** — Campaign → Ad Sets → Ads,每步确认
3. **验证** — 创建后拉取实际配置与表格定义对比

## 关键铁则(Meta API 通用约束 — 所有项目都适用)

1. **表格优先** — 创建广告严格以表格信息为准,不参考在跑广告
2. **人在回路** — 每个创建步骤必须用户确认
3. **Saved Audience 使用方式** — 先 `GET targeting` 内容,再写入 ad set(API 不支持直接传 saved_audience_id,但以配置 saved audience 的检索)
4. **预算单位** — 美分($50 = 5000)
5. **Creative 来源** — `object_story_id` = `{page_id}_{post_id}`,来自已发布的 Page 帖子
6. **POST_ENGAGEMENT 特殊要求** — destination_type=ON_POST,AA=ON 时 device 才在 UI 显示
7. **AA=ON 时 age_max 必须 65** — 否则报错
8. **Lifetime Budget 必须设 end_time** — 否则报错

## 项目个性化(由 introspection 习得,不预设)

下面这些类别的具体值,**每个项目都不一样**,由 项目接入引导 习得后落到 instance / group 文件:

- 命名 segment 顺序与字段名 → `groups/{group}/group.yaml.strategy.naming_pattern`
- 受众 tier 列表与 targeting → `groups/{group}/audiences/*.json`
- 设备定向是否使用、用什么设备列表 → `groups/{group}/audiences/*.json`(若该项目用设备定向)
- CBO/ABO 选择、Lifetime/Daily 选择、默认 optimization_goal → `groups/{group}/group.yaml.strategy.creation`
- placement 默认值 → 同上

## 已接入项目实例参考

> 当前: **无** — `project/instances/` 仅含 `_template/`,首个实例由本 skill 配合 ad-creation-detector 项目接入引导 引导生成。

接入第一个实例后,可在此 section 追加形态参考:
- `instance.yaml` — 账户级 identity / schedule / detection_rules 长什么样
- `groups/{group}/group.yaml` + `notes/` — 一个 group 走完 introspection 后的产物
- `groups/{group}/audiences/` — 受众 tier 文件按 tier 一文件落盘的格式
- `notes/naming-convention.md` — 一个项目反推出的命名规范长什么样
- `notes/report-template.md` — 飞书卡片渲染样式

**⚠️ 不可抄**: 任何已接入实例**只是形态参考,不是模板**。新项目接入必须重新走 项目接入引导,从该项目自己的 sheet + Meta 后台 + 用户确认中重新习得,即便品牌相同(同品牌不同国家、同国家不同产品都不通用)。

## 配置参考

详细的方法论与 Meta API 速查见:
- [references/naming-introspection-method.md](references/naming-introspection-method.md) — 如何反推命名规范
- [references/audience-introspection-method.md](references/audience-introspection-method.md) — 如何解码受众 tier
- [references/sheet-structure-introspection.md](references/sheet-structure-introspection.md) — 如何识别 sheet 结构
- [references/api-params.md](references/api-params.md) — Meta API 参数速查(通用)
- [references/troubleshooting.md](references/troubleshooting.md) — 常见 Meta API 报错与处理(通用)
