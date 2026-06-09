---
name: ad-creation-detector
description: |
  Google Sheet 新增广告检测 + 全流程业务 skill(项目接入引导 → 日常需求检测 → 广告操作执行)。

  使用场景:
  - 把一个新的广告账户 / 国家 / 产品 / 表格接入到本工作区(用户口语:"关联账号"/"绑定账号"/"接入新账户"/"加新国家"/"加新产品"/"配置广告账户"/"表格逻辑梳理"等接入级语义请求)→ 走项目接入引导
  - 从已配置的数据源中检测出新增广告需求,生成飞书卡片报告供操作人确认("触发检测"/"跑检测"/"看下今天有没有新需求"等检测级语义)→ 走日常需求检测
  - 已确认的需求或用户即时指令触发广告操作 → 通过 capability:vh_meta_ads.* 路由执行
  - Slash Commands 入口(确定性触发):/onboard /check /create /copy /update /pause /report

  原则:Sheet 是 source of truth;所有 Meta 创建操作经飞书表单确认 + 用户明确点确认后才执行 + 全 PAUSED。

  不用于:Meta API 直接调用(由 capability:vh_meta_ads.* 路由);表格字段映射方法论本身(去 meta-ads-sheet-mapping)。
---

# ad-creation-detector

> **本文档是什么:** 新增广告检测 → 三端交叉验证 → 飞书报告 → 用户确认 → 创建 → 回填的全流程业务 skill。覆盖项目接入引导(配置引导)+ 日常需求检测(日常检测)+ 隐式周 cron(沉淀 Q&A / 策略)。
> **本文档不是什么:** 不装具体 instance / group 的 detection 规则 / 受众 / 命名(那些在 [groups/{group}/group.yaml](../../instances/_template/groups/_group_template/group.template.yaml));不装 Meta API CLI 用法(由 `capability:vh_meta_ads.*` 路由到底层);不装表单 / 卡片视觉模板(去 [templates/](../../templates/));不装 Meta API 通用踩坑(去 [troubleshooting.md](../meta-ads-sheet-mapping/references/troubleshooting.md))。
> **关联指向:** 创建前 / 后验证流程通过 `capability:vh_meta_ads.verify_post_creation` 调用;能力路由表见 [capability-routing.md](../../capability-routing.md);宏观投放策略指导见 [优化师策略库.md](../../global/优化师策略库.md);授权流程通过 `capability:vhcli_auth.*` 调用。

> **调用前必读 [capability-routing.md](../../capability-routing.md)** — 该文件含全量底层能力索引;业务侧通过 `capability:xxx` 引用,本 skill 不写死底层路径。具体账户与产品配置定位到 `project/instances/{instance}/groups/{group}/group.yaml`。

> **执行边界声明(铁则):** 本 skill **不实现任何 Meta API 调用**。所有 Meta 后台操作(create / update / delete / copy / pause 等)统一通过 `capability:vh_meta_ads.*`(由 [capability-routing.md](../../capability-routing.md) 路由)执行。本 skill 只负责流程编排、规则沉淀、表单生成、用户引导。**严禁在本 skill 范围内或 scripts/ 下新写任何 Meta API 调用脚本**。

---

## 触发与命令

本 skill 支持三层触发,任一命中即激活对应流程。

### 第 1 层:关键词触发(frontmatter description 场景化)

- **项目接入引导** 触发词:关联账号 / 绑定账号 / 接入新账号 / 接入新账户 / 加新国家 / 加新产品 / 配置广告账户 / 表格逻辑梳理 / 新建项目 / 接入项目
- **日常需求检测** 触发词:触发检测 / 跑检测 / 看下今天 / 检测一下 / 拉表格 / 检测新需求

> 广告操作动作类语义(创建/复制/改/换/停)**不在本层触发** — 避免与"项目接入"混淆;通过第 3 层 Slash Commands 或日常需求检测 Step 5/6 自动判定。

### 第 2 层:语义理解(LLM 自动匹配)

非显式关键词时,LLM 按语义匹配,但**仅限"接入"或"检测"语义**:
- "把新账号 / 新产品 / 新国家 / 新表格放进工作区" → 项目接入引导
- "扫描已有数据源、看有没有新增" → 日常需求检测

### 第 3 层:Slash Commands(确定性入口)

| 命令 | 等价自然语言 | 触发流程 |
|---|---|---|
| `/onboard [instance]` | 关联账号 / 接入新账户 / 加新国家 | 项目接入引导 |
| `/check [instance]` | 触发检测 / 看下今天有没有新需求 | 日常需求检测 |
| `/create` | 创建广告 / 上新 | 广告创建动作 |
| `/copy <campaign_id>` | 复制 X / 克隆 X | 广告复制动作 |
| `/update <campaign_id>` | 改 X 预算 / 调 X 受众 | 广告修改动作 |
| `/pause <campaign_id>` | 暂停 X / 关停 X | 广告关停动作 |
| `/report [instance]` | 出 X 报告 / 看下数据 | 报告输出动作 |

**激活规则:**
- 方括号 `[xxx]`:可选参数,无参时进入流程,缺失字段单条追问
- 尖括号 `<xxx>`:必需参数,无参时单条追问"对象 ID 或名称"
- 所有命令均允许无参激活(小白用户友好);带参时直达对应步骤,跳过反问

**广告操作动作前置约束:**
`/create` `/copy` `/update` `/pause` `/report` 仅在 instance 已接入后可用。若 instance 未接入,直接调用会被拒绝并提示先走 `/onboard`。

---

## 自带政策(本业务 skill 加载时必守的 8 条铁则)

### 1. 底层能力调用边界

任何外部 API(Meta / 飞书 / VH 平台)调用必须经 `capability:xxx` 路由(详见 [capability-routing.md](../../capability-routing.md))。严禁:
- 自写 Python / Node / Bash 调 `graph.facebook.com/*` 绕过 capability
- 在 project/ 或 scripts/ 下新增非内置的外部 API 调用代码
- 复制底层 skill references/ 下的内置脚本作为模板自写新脚本
- 把"CLI 不熟" / "需求着急" / "自己写更快"作为绕过理由

capability 路由失败 → 立即报告用户,按 capability-routing 的 [兜底策略] 处置;**绝不自行实现绕过**。

### 2. Fail Loud(响亮失败,不静默)

agent 遇到以下任一情况,必须立即输出报告,等用户决策:
- 找不到对应 capability 路由(全量索引中无匹配)
- 业务流程描述模糊,无法确定下一步
- 需要调外部 API 但 token / 权限不足
- 用户口语含模糊地带(如"创建广告"但未指明哪个账户)
- 想要"优化"或"简化"流程跳过某 step

**绝不静默处理,绝不自作主张**。报告 → 等用户 → 才行动。

### 3. 读写分级

- **读**(查询 Meta 后台 / 拉 Sheet / read 文档): 任何时候自由执行
- **写**(创建 / 修改 / 删除 / 上报): 必经表单 + 用户确认 + Post-flight + audit
- **高风险写**(创建新 Campaign / 大额预算变更): 必经二次确认

### 4. 不主动延伸(最少惊讶原则)

用户没说要做的事不做,模糊地带必报告。提前"优化" / 自作聪明 / "顺手帮你做了" = 流程违规。**用户的话 = 边界,模糊地带 = 报告而非自决**。

### 5. 幂等检查(每次写入前必做)

- 该 source_row 是否已在 `registry.json`?(已建 → 跳过)
- 该名称的广告是否已在 Meta 后台?(已存在 → 跳过)
- 该 cron job id 是否已在 jobs.json?(已注册 → 更新而非新增)

幂等失败时:立即停止 + 报告用户(Fail Loud)。

### 6. 形式红线(无需关键词枚举)

业务侧文档严禁出现以下"形式":
- `<某词>=<值>`(API 字段格式,如 `objective=...`)
- `--<某词>`(CLI flag 格式,如 `--page-id`)
- `https://graph.facebook.com/*`(Meta API URL)
- `skills/*`(底层路径硬编码)
- `$META` / `vhcli agent` / `vhcli project`(底层命令)
- `import requests` / `curl https` 配 facebook(自写调用痕迹)

业务侧用业务概念(广告目标 / 优化目标 / 预算 / 受众等),具体字段由底层 skill 自行翻译。

### 7. 自检失败时区分归因

- agent 自身遗漏的步骤 → 自动补全,无需用户介入
- 用户未提供必要信息 → 单条追问"还差 X,请提供"
- API / 外部调用失败 → 报告失败原因 + 询问是否重试

### 8. 被纠正过的偏差不重复

启动时 read [discipline-lessons](../../../memory/discipline-lessons.md) 把过往偏差作为本次执行的额外约束。

### 9. 删除操作铁律 + 自纠错例外

任何 `capability:vh_meta_ads.*_delete` 调用前,按 [project/global/SAFETY.md](../../global/SAFETY.md) 执行:
- 默认 → §二 完整 RED 协议(6 步)
- 自纠错 → §三 轻量协议(3 步,要求 §三 4 条触发条件全中)

自纠错场景判断责任在 agent 自己:
- ✅ 本会话创建后发现参数错误,立即删除重建
- ❌ 历史对象删除(无论是否仍在跑)
- ❌ 已产生花费的对象
- ❌ 不确定 → 走完整 RED

非删除操作不在本条管辖范围,走原有铁律。

---

新增广告检测 → 验证 → 报告 → 创建 → 回填 全流程 Skill。

> ⚠️ **本 skill 描述检测/验证/报告流程,不预设任何项目的 detection 规则、tier 名、tab 名、卡片文案**。
> 项目个性化由 项目接入引导 习得后落到 `project/instances/{instance}/...`。
> 想看 introspection 完成后的形态参考,接入第一个实例后会落到 `project/instances/{instance}/`(届时该实例**仅作形态参考,不可作为模板复制**)。当前 `project/instances/` 仅有 `_template/`。

## 能力定义

检测 Google Sheet 中的新增广告需求,经三端交叉验证后输出飞书卡片报告,引导用户确认并完成广告创建,最终以飞书卡片形式交付回填内容。

---

## 收工自检

**适用范围:** 任何流程(项目接入引导 / 日常需求检测)结束前,必须执行内部自检。不展示中间过程,只输出最终结论。

1. 该流程定义的所有 step 是否每步都有产出(项目接入引导 见 [A.0–A.10 步骤产出物清单](#a0a10-步骤产出物清单);日常需求检测 见 Step 1-7)
2. 任意 step 没产出时按以下规则归因并处置:
   - **agent 自身遗漏 / 执行顺序错误** → 自动补全,无需用户介入
   - **用户未提供必要信息**(如未确认 group 维度 / 未提供 sheet URL) → 单条追问"还差 X,请提供"
   - **API / 外部调用失败** → 报告错误原因 + 询问是否重试
3. 全部产出齐 → 输出"已完成" + 汇总报告(项目接入引导 见 [项目接入引导 汇总报告](#模式-a-汇总报告))

输出口径:
- 已完成 → 一句话 + 汇总报告(项目接入引导)/ 简短结果(日常需求检测)
- 还差 X → 一句话 + 具体追问 / 已采取的动作

**不输出冗长的 plan / audit 中间过程,用户只看到最终结果或具体追问。**

---

## 运行模式

### 项目接入引导:配置引导(项目初期 / 规则异常)

**第 0 步:read 进度 manifest(每次进入项目接入引导 必做)**

- 若 `project/instances/{instance}/.onboarding_progress.yaml` **已存在** → read 它,从 `last_completed` 的下一步继续(不重新报"我要走 N 步",直接接着干)
- 若 **不存在**(全新接入) → 执行下方"接入新 instance 标准动作":

```
# 1. 复制 instance 模板目录
cp -r project/instances/_template/  project/instances/{new_instance}/

# 2. 重命名模板文件(去掉 .template 中缀,生成实际工作文件)
mv project/instances/{new_instance}/instance.template.yaml          project/instances/{new_instance}/instance.yaml
mv project/instances/{new_instance}/.onboarding_progress.template.yaml  project/instances/{new_instance}/.onboarding_progress.yaml

# 3. patch instance.yaml 的 instance_id / brand / description 字段
# 4. patch .onboarding_progress.yaml 的 instance / brand / started_at 字段
# 5. 进 A.0 开始 onboarding
```

每完成一步必须 patch 该 manifest:
- `steps.A.X.status = "done"`,`completed_at = <now>`,`last_completed = "A.X"`
- 同时把该步的产出物写入对应 yaml 字段(见下方 [A.0–A.10 步骤产出物清单](#a0a10-步骤产出物清单))

**A.4 确认 group 维度后,新增 group 的标准动作:**

```
# 1. 复制 group 模板目录(为 group_dimension.values 中每个值各建一份)
cp -r project/instances/{instance}/groups/_group_template/  project/instances/{instance}/groups/{group_value}/

# 2. 重命名模板文件
mv project/instances/{instance}/groups/{group_value}/group.template.yaml  project/instances/{instance}/groups/{group_value}/group.yaml

# 3. 进 A.5 开始填充 group.yaml(detection / strategy / creation 三段)
```

**触发条件:**
- 全新项目首次接入(新国家 / 新产品表格)
- 规则异常(表格结构变化 / 数据模式不符预期 / Meta 后台名称改动无法匹配)

**完整引导流程(每个新 instance/group 必须走完):**

```
Step 1: 双线并行启动 — Meta 后台扫描 + 数据源询问

  **线程 A:Meta 后台 read-only 扫描** — 必走,所有业务
    目的:理解该账户的实际广告操作逻辑
    方法:抽样 read campaigns / adsets / ads / creatives,不全量 read
    输出:"业务理解报告"(两层结构,详见下方"业务理解报告规范")

  [线程 B:轻量询问数据源]
    向用户发送一句:
      "有 MP 表格 / 业务清单可提供吗?
       - 有 → 提供 URL,可解锁定时新增检测
       - 无 → 直接说操作指令即可(复制 / 改 / 换 / 停),后续可补"
    记录到 instance.yaml.detection_sources.sheet.{enabled, url, note}

  [汇合输出]
    操作模式判定 → 落 group.yaml.strategy.operation_modes.primary
    后台规律 + sheet 规划(若有) → 双源交叉验证

Step 2: 引导用户定义业务规则
        基于 Step 1 输出,引导用户回答:
        - "什么条件下算一条新增广告需求?"
        - "你怎么判断这条已经创建过了?"
        - "有没有取消/暂停的标记?在哪里能看到?"
        Agent 根据用户的业务语言,映射到具体的表格字段(若有 sheet)或后台规律(若无 sheet)

Step 3: Agent 将用户定义转化为可执行规则
        - 有 sheet:确定检测源 tab + 新增条件 + 排除条件 + Meta 后台比对方式
        - 无 sheet:跳过 detection_rule 生成,标记日常需求检测仅支持手动触发

Step 4: 生成 detection_rules(若适用)+ 首次基线快照
        - 有 sheet:detection 字段落 group.yaml.detection;baseline 落 groups/{group}/snapshots/baseline_{date}.json
        - 无 sheet:跳过 detection_rule;baseline 仅记录 Meta 后台快照

Step 5: 注册 cron jobs(详见 [references/cron-registration.md](references/cron-registration.md))
        - 有 sheet 数据源:注册 N 条 instance check + 2 条 weekly_*
        - 无 sheet:仅注册 2 条 weekly_*(check 跳过)
        - 模板见 [templates/cron-jobs.template.json](../../templates/cron-jobs.template.json)

Step 6: 文件存放到 `project/instances/{instance}/groups/{group}/` 下,与其他 instance/group 互不干扰
```

**业务理解报告规范(Step 1 线程 A 输出)**

报告分两层结构:

▌**基础结构(必出 5 项,信心低也要出"待用户确认"占位)**

| # | 项 | 沉淀位置 |
|---|---|---|
| 1 | 命名 pattern | `group.yaml.strategy.naming_pattern` |
| 2 | 预算分配(模式 + 层级) | `group.yaml.strategy.budget` |
| 3 | 受众结构 | `group.yaml.strategy.audiences` |
| 4 | 操作模式判定(new_campaign / copy_modify / mixed) | `group.yaml.strategy.operation_modes.primary` |
| 5 | 投放默认值(objective / opt_goal / billing 等) | `group.yaml.creation.defaults` |

▌**动态扩展(看数据呈现,有规律才出)**

| # | 常见示例(非穷举) | 沉淀位置 |
|---|---|---|
| 6 | 阶段切换习惯 | `groups/{group}/notes/stage-shift.md` |
| 7 | 素材管理习惯 | `groups/{group}/notes/creative-management.md` |
| 8 | 投放节奏 | `优化师策略库.md` 当月归档 |
| 9 | 优化目标分布 | `group.yaml.strategy`(若稳定) |
| 10 | 其他涌现规律 | 按内容性质判定落点 |

**铁则:任何识别出的规律必须沉淀到对应位置,绝不允许只出报告不落地。**

**Step 2 关键原则:**
- 不预设"必须有 Link + Budget"才算新增 — 每个业务/用户的标准不同
- Agent 先给出自己的分析推断,再请用户修正或确认
- 用户的业务语言优先,Agent 负责翻译为技术规则
- 规则可简可复杂,完全由用户业务决定

**引导产出(落点见工作区结构):**
- `project/instances/{instance}/instance.yaml` — 账户级 identity / schedule / detection_rules
- `project/instances/{instance}/groups/{group}/group.yaml` — 分组级 detection / strategy / creation
- `project/instances/{instance}/groups/{group}/snapshots/baseline_{date}.json` — 基线快照
- `project/instances/{instance}/groups/{group}/audiences/*.json` — 受众 tier 文件(若该 group 有受众层)
- `project/instances/{instance}/.onboarding_progress.yaml` — 进度 manifest(每步完成后 patch)
- cron job 条目(`~/.openclaw/cron/jobs.json`)
- 缺失的共享文档 → 提醒用户补充 + 提供自动填充草稿

---

#### A.0–A.10 步骤产出物清单

项目接入引导 的 7 个 Step 实际覆盖 11 个细分步骤(对照 `.onboarding_progress.yaml` 的 `steps.A.X` key 使用)。**收尾审查依此清单逐条校验**:

| Step | 内容 | 必须落地的产出物 |
|---|---|---|
| **A.0** 平台授权 | 通过 `capability:vhcli_auth.platform_login` 完成授权流程 | `~/.vhcli/ad_tokens.json` 中对应账户 token 非空 |
| **A.1** 账号 identity | account / country / currency / timezone | `instance.yaml.identity.{account_id, account_name, country_code, currency, timezone}` 全非空;`project/global/brands/{brand}.yaml` 存在 |
| **A.2** Meta IDs | page / pixel / business / instagram_actor | `instance.yaml.identity.{page_id, pixel_id, business_id, instagram_actor_id}` 全非空 |
| **A.3** 通知通道 | feishu chat_id | `instance.yaml.notification.feishu.chat_id` 非空 |
| **A.4** 分组维度 | 产品 / 阶段 / 素材...由用户定 | `instance.yaml.group_dimension.{name, sheet_field, values}` 已 patch;`groups/{value}/` 子目录已从 `_group_template/` cp |
| **A.5** sheet 结构(若 detection_sources.sheet.enabled) | tab / column_map / detection 触发列(走 [sheet-structure-introspection.md](../meta-ads-sheet-mapping/references/sheet-structure-introspection.md)) | 有 sheet:`groups/{group}/group.yaml.detection.sheet.{spreadsheet_id, tab_name, gid, column_map}` 已 patch;无 sheet:跳过,标 skipped |
| **A.6** 命名反推 | segment 顺序 / 拼接规则(走 [naming-introspection-method.md](../meta-ads-sheet-mapping/references/naming-introspection-method.md)) | 有 sheet:sheet 命名规范 + 后台 pattern 双源验证;无 sheet:仅后台 pattern 反推。最终落 `groups/{group}/group.yaml.strategy.naming_pattern.{template, segments}` |
| **A.7** 受众解码 | tier 列表 / saved_audience_id(走 [audience-introspection-method.md](../meta-ads-sheet-mapping/references/audience-introspection-method.md)) | 有 sheet:sheet tier 描述 + 后台 saved_audience 双源验证;无 sheet:仅后台 saved_audience + targeting 反推。最终落 `groups/{group}/group.yaml.strategy.audiences.tiers` 非空 + `groups/{group}/audiences/*.json` 已写入 |
| **A.8** 投放默认值 | objective / opt_goal / billing / placement / budget | 有 sheet:sheet 当次值 + 后台高频值;无 sheet:仅后台高频值。最终落 `groups/{group}/group.yaml.creation.defaults` + `group.yaml.strategy.{budget, placement, destination_type}` |
| **A.9** detection 规则 | 用户业务语言 → DSL 表达式 | 有 sheet:`groups/{group}/group.yaml.detection.detection_rule` 非空 + `groups/{group}/snapshots/baseline_{date}.json` 已写入;无 sheet:标 skipped + note: "无 sheet,日常需求检测仅支持手动触发" |
| **A.10** cron 注册 | 按 [cron-registration.md](references/cron-registration.md) SOP + [cron-jobs.template.json](../../templates/cron-jobs.template.json) 模板,生成并写入 `~/.openclaw/cron/jobs.json` | 有 sheet:N 条 `ad_check_{instance}_*` + 2 条 weekly_*;无 sheet:仅 2 条 weekly_*(check 跳过) |

**收集顺序:**
- A.0 必须最先(无 token 后续步骤无法执行)
- A.1–A.4 可在与用户对话期间并行收集(任一信息得到答案后即 patch,不要求严格串行)
- A.5–A.9 需要 sheet 与历史广告数据,通常顺序进行,允许穿插(用户提供新信息时即时 patch 对应字段)
- A.10 必须最后执行(依赖 A.0–A.9 已就绪);默认必走,**用户明确表态可跳过**(标记 `skipped`,不计入缺失)

**硬性要求:** 所有状态为 done 的步骤,产出物在 [收尾审查](#模式-a-收尾审查) 时必须齐全;skipped 步骤需在 manifest 的 note 字段记录原因。

---

#### 项目接入引导 收尾审查

**适用范围:** 走完 A.0–A.10 所有步骤后强制执行,这是 [收工自检](#收工自检) 在项目接入引导 的具体落地。

1. **read 三个文件**:`project/instances/{instance}/instance.yaml`、`groups/{group}/group.yaml`、`.onboarding_progress.yaml`(如有 brand 层级也 read `brands/{brand}.yaml`)
2. **对照 [A.0–A.10 步骤产出物清单](#a0a10-步骤产出物清单)**,逐条核对是否落地;A.10 还要 read `~/.openclaw/cron/jobs.json` 校验 N+2 条 job 已注册
3. **缺失字段触发智能归因 + 自动处置:**
   - **agent 自身遗漏 / 执行顺序错误** → 自动补全该步,无需用户介入
   - **用户未提供必要信息**(如未确认 group 维度 / 未提供 sheet URL) → 单条追问"还差 X,请提供"
   - **API / 文件写入失败**(如拿不到 page_id / cron jobs.json 写权限不足) → 报告失败原因 + 询问是否重试
   - **A.10 用户明确表态跳过** → 不算缺失,manifest 标记 `skipped` 并在 note 字段记录原因
4. **全部产出物落地** → 输出汇总报告(下节)

**不展示中间审查过程,只输出最终结论或具体追问。**

---

#### 项目接入引导 汇总报告

**适用范围:** 收尾审查通过后必须输出,展示给用户(此为项目接入引导 唯一面向用户的结构化输出)。

走完所有 step 且收尾审查通过后,输出一份 markdown 表格汇总(用户可见):

| Step | 状态 | 关键产出 |
|---|---|---|
| A.0 平台授权 | ✅ 完成 | token 已就位 |
| A.1 账号 identity | ✅ 完成 | `<account_id>`,country=`<CC>`,brands/`<brand>`.yaml |
| A.2 Meta IDs | ✅ 完成 | page / pixel / business / instagram 四 ID 已 patch |
| A.3 通知通道 | ✅ 完成 | feishu chat_id 已 patch |
| A.4 分组维度 | ✅ 完成 | dimension=`<name>`,values=[...] |
| A.5 sheet 结构 | ✅ 完成 | column_map 已 patch |
| A.6 命名反推 | ✅ 完成 | naming_pattern 已 patch |
| A.7 受众解码 | ✅ 完成 | `<N>` 个 tier,saved_audience_id 已映射 |
| A.8 投放默认值 | ✅ 完成 | objective / opt_goal / billing / budget |
| A.9 detection 规则 | ✅ 完成 | detection_rule 表达式 + baseline_`<date>`.json |
| A.10 cron 注册 | ✅ 完成 / 已跳过 | N 条 instance check + 2 条 weekly_*(若启用);跳过则在 manifest note 字段记录原因 |

**后续动作建议:** `<例如:启动 cron / 进入日常需求检测 日常检测 / 等用户测试一轮后再正式上线>`

(中间审查的 audit 详情**不展示**,只展示这份最终汇总。)

---

### 日常需求检测:日常检测(配置完成后)

**启用条件:**
`instance.yaml.detection_sources` 中至少一个数据源 `enabled: true` 时,本流程的定时检测自动启用。
全部 `enabled: false` 时,定时检测不启用,但用户即时指令(`/check` 或自然语言"触发检测"等)仍可手动触发。

**触发方式:**
- 定时:每工作日 10:10 / 15:00 / 18:30(仅当至少一个 detection_sources enabled 时)
- 手动:Slash Command `/check [instance]` 或自然语言"触发检测"等检测级语义

**检测流程:**

```
Step 1: 拉取表格
  └ 按 group.yaml.detection.sheet 中的 spreadsheet_id + gid 配置,导出 CSV
  └ 自动发现 project/instances/ 下所有已配置 instance/group

Step 2: 新增检测
  ├ 按各 group group.yaml.detection.detection_rule 表达式逐个扫描
  ├ 与本地快照 diff(发现新增行 / 状态变化行)
  └ 筛选满足新增条件的行

Step 3: 三端交叉验证
  ├ 端1: 本地快照(上次检查状态)
  ├ 端2: 在线表格(当前最新状态)
  └ 端3: Meta 后台(实际已创建的广告)
  └ 比对方式:表格 Content ↔ Meta campaign name creative 字段模糊匹配

Step 4: 输出报告(飞书原生交互卡片)
  └ 一张卡片汇总所有在检测的 instance/group
  ├ ✅ 已创建+匹配 — 表格有 + Meta 有
  ├ 🆕 新增未创建 — 表格有新增信号 + Meta 无 → 展示明细
  ├ ⚠️ 变更预警 — 表格/Meta 不一致
  └ 📭 无新增任务 — 无变化

Step 5: [有需要操作的项时] 按 operation_modes.primary 选择对应表单
  read group.yaml.strategy.operation_modes.primary,选择路径:

  case primary == "new_campaign"(默认,创建型业务):
    → 走完整 13 字段表单(templates/ad-creation-form.md)
    → 强制阅读 group.yaml.strategy(项目默认值)+ Meta广告执行QA.md(12 条 safety rails)
    → 表单上显式标出预算模式 / 预算层级 / 出价策略,让用户对这一行也确认

  case primary == "copy_modify"(修改型业务):
    → 走轻量表单(只列源 ID + 改动字段,不列未变更的字段)
    → 适用场景:复制原 campaign 改日期预算 / 修改 ad set 受众 / 替换素材 / 关停等

  case primary == "mixed":
    → 按本次任务性质动态判定(看用户口语含"创建"还是"复制 / 改 / 换 / 停")
    → 创建走 new_campaign 表单,修改走 copy_modify 表单

Step 6: 用户**明确文字确认** → 调用底层能力执行(铁则)

  **强制路径(任意一项跳过即流程违规):**
  1. read [capability-routing.md](../../capability-routing.md) [全量索引] 段,确认 `capability:vh_meta_ads.*` 已就绪
  2. 按操作类型选择对应 capability 执行:
     - 新建 Campaign → `capability:vh_meta_ads.campaign_create`
     - 新建 Ad Set → `capability:vh_meta_ads.adset_create`
     - 新建 Ad → `capability:vh_meta_ads.ad_create`
     - 新建 Creative → `capability:vh_meta_ads.creative_create`
     - 复制 Campaign → `capability:vh_meta_ads.campaign_copy`
     - 修改 Ad Set 预算/受众 → `capability:vh_meta_ads.adset_update`
     - 替换 Creative → `capability:vh_meta_ads.ad_replace_creative`
     - 关停广告 → `capability:vh_meta_ads.campaign_pause` / `adset_pause` / `ad_pause`
  3. 调用参数来源:
     - 操作字段 ← 本次确认表单(详见 [templates/ad-creation-form.md](../../templates/ad-creation-form.md))
     - 默认值 ← `group.yaml.strategy`
     - 账户身份 ← `instance.yaml.identity`
  4. 12 条 safety rails 见 [Meta广告执行QA.md](../../../Meta广告执行QA.md);创建前/后 review 走 `capability:vh_meta_ads.verify_pre_creation` + `verify_post_creation`

  **严禁(任一即违规):**
  - 在本 skill 或 scripts/ 下新写 Python / Node / Bash 脚本调外部 API
  - 用 curl / requests / SDK 绕过 capability 直调 Meta API
  - 复制底层 skill references/ 下的内置脚本作为模板自写新脚本

  **capability 路由失败时的处置(由 [capability-routing.md](../../capability-routing.md) 兜底策略决定):**
  - 必填 capability 缺失 → 立即报告用户,业务流程暂停
  - 可选 capability 缺失 → 降级处理 + 在 discipline-lessons 标注

  **用户提修改时:**
  - 重出完整表单 → 再等明确确认(严禁"改了就直接调底层")
  - 任何同步 Meta 后台的动作前都必须有一次针对当前表单的明确文字确认

Step 7: 状态回传
  ├ 更新本地快照
  ├ 写入 Meta 比对日志(静默,不展示)
  └ 飞书卡片展示回填内容
```

---

## 报告展示规范

统一使用**飞书原生交互卡片**(通过 `scripts/report_card.cjs` 发送,卡片底层结构与样式由用户 lock,不动)。

### 卡片结构(占位符示意,实际值由各 instance/group 填充)

```
┌─ Header ──────────────────────────────────────┐
│ [emoji] 广告新增检测报告 | YYYY-MM-DD HH:MM   │
│ 颜色: green / orange / red                     │
├───────────────────────────────────────────────┤
│ 顶部汇总: "📭 无新增任务 · 已检测 N 个产品"     │
│        或: "🆕 发现新增 N 条 · 覆盖 M 个产品"   │
├─ 分割线 ──────────────────────────────────────┤
│ 🏳 {Country} ({CC}) · {Account_Name}          │
│                                                │
│ {Group_A} · {Detection_Tab_A}                 │
│ ┌──────┬──────┬──────┬──────┐                │
│ │✅Done │🔗Link│⬜待补 │❌取消 │                │
│ │  N    │  M   │  K   │  J   │                │
│ └──────┴──────┴──────┴──────┘                │
│                                                │
│ {Group_B} · {Detection_Tab_B}                 │
│ ┌──────┬──────┬──────┬──────┐                │
│ │✅Done │🔗Link│⬜待补 │❌取消 │                │
│ │  N    │  M   │  K   │  J   │                │
│ └──────┴──────┴──────┴──────┘                │
│                                                │
│ [如有新增,展开明细:]                           │
│ 🆕 {Group_A} 新增 N 条:                       │
│ 1. {Content} · ${Budget} · {Date}             │
│    🔗 {Link}                                   │
├─ 分割线 ──────────────────────────────────────┤
│ 🏳 {Country_2} ({CC_2}) · {Account_Name_2}    │
│ ...(同结构)                                    │
├─ 分割线 ──────────────────────────────────────┤
│ 🕒 下次检测: {next_time}                       │
│ 📋 监测 instance: 🏳 {C1} · 🏳 {C2}            │
└───────────────────────────────────────────────┘
```

### 四种场景

| 场景 | 卡片颜色 | 行为 |
|------|----------|------|
| 有新增(任意档次) | 🟠 orange | 发送卡片 + 新增明细 + 全局统计 |
| 无新增 + 10:10 / 18:30 | 🟢 green | 发送卡片,仅全局统计(早晚两档要让运营看到状态) |
| 无新增 + 15:00 | (静默) | 仅写日志,不发卡(中午减打扰) |
| 异常 | 🔴 red | 发送卡片 + 异常描述 + 处理选项,任意时间点都发 |

> 这套行为由 `instance.yaml.schedule.rules` 决定,各 instance 可调;具体规则与卡片颜色规则见 [references/report-card-contract.md](references/report-card-contract.md)。

### 多 instance 汇总

- 一张卡片覆盖**所有在检测的 instance / group**
- 自动扫描 `project/instances/` 目录发现已配置 instance
- 按 instance 分 section,每个 instance 下挂多个 group
- 后续新增 instance / group,卡片自动扩展

---

## 定时任务规则

> **默认排班(可由 `instance.yaml.schedule` 覆盖):** 10:10 / 15:00 / 18:30,Asia/Shanghai,工作日执行(周一至周五)。

| 时间 | 条件 | 行为 |
|------|------|------|
| 10:10 | 有新增 | 🟠 发橙色卡片(含明细) |
| 10:10 | 无新增 | 🟢 发绿色卡片(全局统计) |
| 15:00 | 有新增 | 🟠 发橙色卡片(含明细) |
| 15:00 | 无新增 | (静默,仅写日志,不发卡) |
| 18:30 | 有新增 | 🟠 发橙色卡片(含明细) |
| 18:30 | 无新增 | 🟢 发绿色卡片(全局统计) |
| 任意时间 | 抓取异常 / API 失败 | 🔴 发红色卡片 + 异常描述,等用户处置 |

- **10:10 / 18:30 全档发卡** — 让运营在早晚两档都能看到一次状态确认
- **15:00 仅有新增发卡** — 中午时段除非有新增否则静默,避免打扰
- 时区 Asia/Shanghai(运营所在时区,与账户 ad account timezone 解耦)
- 这套规则由 `instance.yaml.schedule.rules` 决定,各 instance 可调
- cron 配置位置:`~/.openclaw/cron/jobs.json`(注册 SOP 见 [references/cron-registration.md](references/cron-registration.md))
- 卡片数据契约见 [references/report-card-contract.md](references/report-card-contract.md)

### 隐式周 cron(沉淀,不报告)

| 时间 | 任务 | 沉淀目标 | 行为 |
|------|------|----------|------|
| 周日 22:00 | Q&A 周汇总 | `Meta_Ads_Workspace/Meta广告执行QA.md`(项目根) | 当周遇到的踩坑 / 异常 / 解决方案,**只更新文档,不发卡片** |
| 周日 22:10 | 策略周汇总 | `project/global/优化师策略库.md` | 当周宏观投放策略沉淀(节奏 / 阶段目标 / 效果优化方向 / 跨产品调整原则),**只更新文档,不发卡片** |

- 这两条 cron 都是隐式的(不通知用户,不出现在卡片里)
- **沉淀目标分文件**: Q&A 类内容(具体问题 + 解决方案,带日期)落 Meta广告执行QA.md;策略类内容(规则 / 默认值 / 倾向)落 优化师策略库.md。**不要混写**
- 用户随时可读 [Meta广告执行QA.md](../../../Meta广告执行QA.md) / [优化师策略库.md](../../global/优化师策略库.md) 查看
- 关联铁则:这是"知识库沉淀"动作,不是"汇报"动作 — 永远静默

---

## Meta 比对日志

- 每次检测自动记录完整比对结果到 `project/instances/{instance}/groups/{group}/logs/`
- 文件名格式:`detect_YYYYMMDD_HHMM.json` / `meta_verify_YYYYMMDD.json`
- **静默归档,不展示** — 仅在回溯差异、排查问题时查阅
- 记录内容:检测时间、触发方式、各 group 统计、新增条目、Meta 匹配结果

---

## 技术栈

| 类型 | 文件 | 用途 |
|------|------|------|
| md | SKILL.md / instance.yaml / group.yaml | 流程定义 + 规则文档 |
| json | snapshots/*.json / audiences/*.json | 配置 + 状态快照 |
| python | scripts/fetch_sheet.py / scripts/check_new_ads.py | Google Sheet 导出 + 检测逻辑 |
| node (cjs) | scripts/report_card.cjs | 飞书原生卡片发送 |

---

## 文件结构

```
project/ad-creation-detector/                # 本 skill 自身
├── SKILL.md                                 # 本文件(skill 入口)
└── references/
    └── report-template.md                   # 通用文案占位模板(纯文本备用)

project/instances/{instance}/                # 各 instance 自治
├── instance.yaml                            # 账户级 identity / schedule / detection_rules
├── notes/                                   # instance 级软经验
└── groups/{group}/                          # 分组级
    ├── group.yaml                           # detection / strategy / creation
    ├── audiences/                           # 受众 tier JSON(若该 group 有受众层)
    ├── snapshots/                           # baseline 与 detect 快照
    │   ├── baseline_{date}.json
    │   └── detect_{datetime}.json
    ├── logs/                                # detection / verify 日志
    │   ├── detect_{datetime}.json
    │   └── meta_verify_{date}.json
    └── notes/                               # group 级软经验(introspection 结果记录)

scripts/                                     # 工程根全局脚本
├── fetch_sheet.py
├── check_new_ads.py
└── report_card.cjs
```

---

## 新增定义(项目个性化)

通过项目接入引导 引导确认。落点:

- 检测源 tab + 列 → `instances/{instance}/groups/{group}/group.yaml.detection.sheet` + `column_map`
- 新增就绪表达式 → `group.yaml.detection.detection_rule`
- 完成/取消标记识别 → `instance.yaml.detection_rules.completed_signal` 或 group 级覆盖
- 与 Meta 后台比对方式 → `instance.yaml.detection_rules.match_key`

接入新 instance/group 时,Agent 主动引导用户走完项目接入引导 完整流程,生成独立配置,**不复制其他 instance 的规则**。

---

## report_card.cjs 使用说明

> 卡片底层结构与样式由用户 lock,不动。下面是数据接口约定。

### 数据格式(占位符示意)

```json
[
  {
    "project_id": "<instance_id>",
    "country": "<Country (CC)>",
    "flag": "🏳",
    "account_name": "<Account_Name>",
    "products": [
      {
        "name": "<Group_Name>",
        "tab_name": "<Detection_Tab_Name>",
        "stats": {"done": N, "link": M, "pending": K, "cancel": J},
        "new_items": [
          {"date": "<MM-DD>", "content": "<素材名>", "budget": "<USD>", "link": "<URL>"}
        ]
      }
    ]
  }
]
```

### CLI 调用

```bash
# 传入完整 JSON 数据
node scripts/report_card.cjs '<json_array>'

# 无参数时使用默认测试数据
node scripts/report_card.cjs
```

### 程序化调用

```js
const { sendMultiProjectReport, discoverProjects } = require('./scripts/report_card.cjs');

// 发送报告
await sendMultiProjectReport(projectReports, '<chat_id>');
```

---

## 已接入项目实例参考

> 当前: **无** — `project/instances/` 仅含 `_template/`,首个 instance 由本 skill 项目接入引导 引导生成。

接入第一个实例后,可在此 section 追加:
- `instance.yaml` 形态参考 — 账户级 identity / schedule / detection_rules 长什么样
- `groups/{group}/group.yaml` 形态参考 — 走完 introspection 后的产物
- `groups/{group}/audiences/` 形态参考 — 受众 tier 文件落盘格式
- `notes/report-template.md` 形态参考 — 项目实际渲染出的飞书卡片文案

**⚠️ 不可抄**: 任何已接入实例**只是形态参考,不是模板**。新 instance / group 接入必须重新走项目接入引导,从该项目自己的 sheet + Meta 后台 + 用户确认中重新习得。同品牌不同国家、同国家不同产品都不通用。

---

## 文档复用原则

以下文档如已存在则直接引用,缺失时:
1. 提醒用户该文档缺失
2. 提供自动填充草稿
3. 用户确认后正式补充

共享方法论(skill 级,通用):
- `project/meta-ads-sheet-mapping/references/naming-introspection-method.md` — 命名规则反推方法论
- `project/meta-ads-sheet-mapping/references/audience-introspection-method.md` — 受众解码方法论
- `project/meta-ads-sheet-mapping/references/sheet-structure-introspection.md` — sheet 结构识别方法论
- `project/meta-ads-sheet-mapping/references/api-params.md` — Meta API 通用速查
- `project/meta-ads-sheet-mapping/references/troubleshooting.md` — Meta API 通用踩坑
- `templates/ad-creation-form.md` — 创建确认表单模板
- `capability:vh_meta_ads.*`(由 [capability-routing.md](../../capability-routing.md) 路由)— Meta API 底层能力

项目个性化(instance / group 级,各自独立):
- `instances/{instance}/notes/` — instance 级软经验
- `instances/{instance}/groups/{group}/notes/` — group 级软经验
