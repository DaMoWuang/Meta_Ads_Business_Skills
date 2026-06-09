# 执行纪律教训累积

> **本文档是什么:** 累积 agent 在执行流程中被用户纠正过的偏差记录(包括跳步、未使用模板、流程提前结束、代为决策、依赖记忆未读取文档等),作为后续会话的额外约束。
> **本文档不是什么:** 不是项目业务知识(那些去 group/notes/ 或 优化师策略库.md);不是 Meta API 通用问题(去 Meta广告执行QA.md / troubleshooting.md);不是用户偏好(去 user_preference 类 memory)。
> **何时加载:** agent 启动时若本文件非空,自动 read 一次,把过往被纠正过的执行偏差作为本次会话的隐式约束。
> **何时追加:** 用户纠正了 agent 的执行偏差时(如指出"未使用模板"、"跳过了某步"、"代为决策"等),agent 必须在本次会话末尾或下次启动前把教训写入此文件。
> **初始化包内为空** — 接入第一个实例并经历用户纠正后由 agent / 用户追加。

---

## 格式

每条记录使用以下格式:

```
- YYYY-MM-DD | <被纠正的偏差描述> — 教训:<下次执行时的具体规则>
```

格式示例(虚构,展示用):
```
- 2026-XX-XX | 创建广告时依赖记忆生成表单,缺失"Bid Strategy"字段 — 教训:每次生成表单前必须 read templates/ad-creation-form.md,核对 13 个核心字段是否齐全
- 2026-XX-XX | 用户表达"接入新国家"时直接询问 sheet,跳过 vhcli 授权步骤 — 教训:项目接入引导 必须从 A.0 平台授权开始,不可跳至 A.5
```

---

## 教训

- **接入期通用教训(初始化包预置)** | agent 在执行 Meta 广告操作(创建 / 复制 / 修改 / 关停 / 替换素材等)时,自写 Python / curl / Node 脚本调外部 API,绕过 `capability:*` 路由的现有底层能力 — 教训:**业务侧 skill(ad-creation-detector / meta-ads-sheet-mapping 等)不实现任何外部 API 调用**;所有 Meta / 飞书 / VH 平台操作必经 `capability:xxx`(由 [capability-routing.md](../project/capability-routing.md) 路由);capability 路由失败时按其 [兜底策略] 处置,**绝不自行实现绕过**。详见 [ad-creation-detector/SKILL.md "自带政策"](../project/skills/ad-creation-detector/SKILL.md) 段。

- **业务理解报告必沉淀(初始化包预置)** | agent 在项目接入引导 A.5 双线扫描后,只输出"业务理解报告"展示给用户,但未把识别出的规律落到对应 yaml / notes 文件 — 教训:**任何识别出的规律必须沉淀到对应位置**;5 项基础结构(命名 / 预算 / 受众 / 操作模式 / 投放默认值)必出且必落 group.yaml.strategy 对应字段;动态扩展规律(阶段切换 / 素材管理 / 投放节奏等)按内容性质落 group.yaml.notes / 优化师策略库.md。**绝不允许只出报告不落地。**

- **接入期通用教训(删除操作,初始化包预置)** | agent 执行删除操作(campaign/adset/ad/creative_delete 或一次操作含 ≥3 个删除)时,凭口头确认即执行,漏 get 回读 / 漏 spend 快照 / 漏二次确认 / 漏审计落盘 — 教训:**所有删除走 [project/global/SAFETY.md](../project/global/SAFETY.md)**,默认完整 RED 协议(6 步);仅当"本会话创建 + 始终 PAUSED + 零花费 + ≤30min" 4 条全中时走自纠错轻量协议(3 步)。审计写 `project/instances/{instance}/groups/{group}/logs/high-risk-ops.jsonl`。非删除操作不在本条范畴。

<!-- 接入实例后由 agent / 用户在被纠正时追加 -->
