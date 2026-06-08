# 广告创建确认表单模板（默认格式）

> **本文档是什么:** 飞书确认表单的**结构模板**(项目|内容 表格 / Campaign 独立表 / 汇总区) + 创建确认流程铁律(明确确认 / 修改重出表单)。模板结构 lock,只填数据,不改结构。
> **本文档不是什么:** 不装具体 Campaign 参数(那些来自 sheet + group.yaml.strategy 当次填充);不装飞书卡片底层渲染逻辑(由 `capability:feishu_native_card.*` 路由);不装 Meta API 调用规则(由 `capability:vh_meta_ads.*` 路由)。
> **关联指向:** 创建结果回填表格在本文末尾;创建前/后强制 review 通过 `capability:vh_meta_ads.verify_pre_creation` + `verify_post_creation` 完成;能力路由表见 [capability-routing.md](../capability-routing.md)。

> 使用场景：每次创建Meta广告前，生成此格式的确认表单，经操作人确认后再执行创建。
> 确认人：操作人 / 表单接收人（按 instance.yaml.notification 路由）
> 状态：模板格式已 lock，非用户需求不改结构，只填数据

---

## 输出 schema(核心字段锁定 + 允许扩展)

任何确认表单输出必须包含以下 **13 个核心字段**,顺序不可调整,字段不可缺失:

```
1. Campaign Name        2. 产品                3. Objective
4. Optimization Goal    5. Billing Event       6. 预算
7. Bid Strategy         8. 排期                9. 素材类型
10. 素材内容            11. 素材链接           12. Ad Name
13. Ad Sets
```

**允许根据实际情况补充字段:** 若该次创建的 sheet 行包含本模板未列的特殊字段(如 Phase / Audience Tier / Custom Tracking / Naming Suffix 等),可在 13 个核心字段**之后追加补充行**,不应插入到核心字段顺序之间。

**自检:** 输出后核对 13 个核心字段是否全部出现,缺一个视为输出违规,需重做。补充字段不计入"缺失"。

**铁则:** 每次生成表单前必须 read 本模板;不依赖记忆生成,记忆与实际模板之间的偏差是常见错误来源。

---

## 表单确认后的执行铁则

用户对本表单输出明确确认后,执行环节必须通过 `capability:vh_meta_ads.*`(由 [capability-routing.md](../capability-routing.md) 路由到对应底层 skill)调用。

**严禁:**
- 业务侧(ad-creation-detector / 本表单生成方等)自写 Python / Node / Bash 脚本调外部 API 绕过 capability
- 在 scripts/ 或业务流程任何位置新增非内置的 Meta API 调用代码
- 复制底层 skill references/ 下的内置 .py 脚本作为模板自写新脚本

**capability 路由失败时:** 按 [capability-routing.md](../capability-routing.md) 兜底策略处置(必填能力缺失立即报告用户;可选能力缺失降级处理),不自行实现绕过。

详见 [ad-creation-detector/SKILL.md](../skills/ad-creation-detector/SKILL.md) 的"自带政策"段。

---

## 模板结构

### 标题
```
📋 [Group_Display_Name] Campaign 创建确认表单
```

### 每个Campaign用独立表格展示

```
**🔹 Campaign #N**
| 项目 | 内容 |
|---|---|
| Campaign Name | 完整campaign命名 |
| 产品 | 产品名称 |
| Objective | OUTCOME_ENGAGEMENT / OUTCOME_TRAFFIC / ... |
| Optimization Goal | POST_ENGAGEMENT / THRUPLAY / LINK_CLICKS / ... |
| Billing Event | IMPRESSIONS |
| 预算 | Lifetime $XX（CBO/ABO） |
| Bid Strategy | LOWEST_COST_WITHOUT_CAP |
| 排期 | MM.DD → MM.DD |
| 素材类型 | Poster / Video / Album / Animation |
| 素材内容 | 素材描述 |
| 素材链接 | Facebook帖子链接 |
| Ad Name | 广告层名称 |
| Ad Sets | 列出所有Ad Set名称 |
```

### 汇总区

```
**汇总：X Campaign / Y Ad Sets / Z Ads**
全部使用 [optimization_goal]，Billing [billing_event]
账户：[account_id]（[account_name]）
受众：[受众来源说明]
```

---

## 规则

1. **一个Campaign一张表** —— 不要把多个campaign挤在一个表里
2. **所有关键参数必须展示** —— 不可省略任何一行
3. **有变更加粗+✅标注** —— 如某字段从默认值修改过,用 **加粗** + ✅ 提示
4. **汇总放在最后** —— 让确认人一眼看到总量
5. **确认前不执行**(铁律) —— 表单发出后等待用户**明确文字确认**(如"确认"/"OK"/"创建"),不可自行创建
6. **修改意见 = 重出表单,不是直接执行**
   - 用户对表单提出修改后,必须**重新生成完整表单**贴回飞书,等用户对新表单**再次明确确认**
   - 严禁"用户说'把预算改成 30'就直接后台创建"——任何同步 Meta 后台的动作前必须有一次"用户对当前表单的明确文字确认"
   - 重出表单时,把改动字段加粗 + ✅,让用户知道改了哪些
7. **可读性优先** —— 飞书群内用表格形式,避免纯文本列表

---

## 完整示例

**📋 {Group_Display_Name} Campaign 创建确认表单**

**🔹 Campaign #1**
| 项目 | 内容 |
|---|---|
| Campaign Name | {按 group.yaml.strategy.naming_pattern 拼接出的完整命名} |
| 产品 | {Product_Name} |
| Objective | OUTCOME_ENGAGEMENT |
| Optimization Goal | POST_ENGAGEMENT |
| Billing Event | IMPRESSIONS |
| 预算 | Lifetime ${Amount}（CBO） |
| Bid Strategy | LOWEST_COST_WITHOUT_CAP |
| 排期 | MM.DD → MM.DD |
| 素材类型 | Poster |
| 素材内容 | {素材描述} |
| 素材链接 | {Facebook 帖子链接} |
| Ad Name | {Ad 命名} |
| Ad Sets × N | {T1_xxx / T2_xxx / ...,由该 group audiences/ 决定} |

（后续Campaign同结构重复...）

---

**汇总：X Campaign / Y Ad Sets / Z Ads**
全部使用 POST_ENGAGEMENT，Billing IMPRESSIONS
账户：{account_id}（{account_name}）
受众：{受众来源说明,例如"复用 group audiences/ 中已配置的 tier targeting"}

---

## 创建结果表单模板

创建完成后用简洁表格汇报：

```
📊 创建结果：

| # | Campaign | Ad Sets | Ads | Status |
|---|---|---|---|---|
| 1 | [简称] | 9 | 9 | PAUSED |
| 2 | [简称] | 9 | 9 | PAUSED |

总计：X Campaign / Y Ad Sets / Z Ads ✅
Status: All PAUSED（等待确认后 publish）
```
