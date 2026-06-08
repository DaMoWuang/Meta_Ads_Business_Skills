# Capability Routing — 全量功能索引

> agent 加载本业务 skill 包时必读。业务侧 SKILL.md 通过 `capability:<功能名>` 引用底层能力,本文件路由到具体路径。[全量索引] 段由 agent 启动时自动扫描维护。

---

## 一、启动流程

agent 加载本业务 skill 包时执行:

1. read 本文件
2. 检查 [全量索引] 段:
   - 已填 → 直接用索引路由
   - 为空(全新接入) → 执行下一步全量扫描
3. 全量扫描 skills/:
   - list `skills/` 下所有目录
   - read 每个目录的 `SKILL.md` 完整内容(frontmatter + 正文 + references 顶部说明)
   - LLM 语义理解每个 skill 的能力范围,提取所有功能(含子能力 sub_capabilities)+ 路径 + 信心分(0-1)
4. 写回 [全量索引] 段(下次启动直接用,不重扫)
5. 输出"路由报告":
   ```
   扫描完成,可用 capability 清单:
     - vh_meta_ads(信心 1.0): 11 个子能力(campaign_create / campaign_copy / ...)
     - feishu_native_card(信心 1.0): 2 个子能力
     - vhcli_auth(信心 1.0): 3 个子能力
   ```

---

## 二、Capability 引用约定

业务侧 SKILL.md 引用方式(两种都支持):

### 方式 A:精确引用(推荐)

```
调用 capability:vh_meta_ads.campaign_create
调用 capability:feishu_native_card.card_send
调用 capability:vhcli_auth.audit_record
```

格式:`capability:<namespace>.<sub_capability_name>`(取自 [全量索引])。

### 方式 B:意图描述(灵活,语义匹配)

```
调用一项能力:创建 Meta Campaign
调用一项能力:发送飞书状态卡片
```

agent 在 [全量索引] 中按 intent 语义匹配,选信心最高的 sub_capability。

---

## 三、[全量索引]

<!-- 本业务包内本段为空 — 移植到任意 agent 后,首次启动由 agent 自动扫描该 agent 的 skills/ 目录,语义匹配后自动填入 -->
<!-- 后续启动直接 read 本段即可 -->
<!-- 路径变更 / 加新底层 skill:重启 agent 自动重扫更新 -->

```yaml
# 索引 schema:
#   <namespace>:
#     path: <skill 主入口路径>
#     intent: <该 skill 的语义描述>
#     confidence: <语义匹配信心分 0-1>
#     sub_capabilities:
#       - name: <sub_capability_name>
#         intent: <子能力的具体业务意图>

# (本段为空,由 agent 首次启动时全局扫描该 agent 的 skills/ 目录后自动填入)
```

---

## 四、兜底策略

### 业务侧引用了索引中没有的能力

- 报告用户:"业务侧请求 `capability:xxx`,全量索引中无对应能力"
- 列出索引中最接近的 3 个候选(按语义相似度排序)
- 让用户决策:从候选中选 / 跳过该步骤 / 报告"需扩展底层 skill"
- 绝不自行实现绕过

### 全量扫描发现新能力

- agent 自动加入 [全量索引]
- 输出"新增能力清单":告知用户"现在新增可用 capability:xxx"

### 路径变更

- 重启 agent → 自动重扫 → [全量索引] 自动更新
- 业务侧 SKILL.md 引用的 capability 名不变

### 多候选歧义

- 取信心分最高的 sub_capability
- 信心差距 < 0.1 时报告用户选择,选择结果写回索引

### 信心分阈值

- < 0.6 → 报告用户"路由信心较低,请确认"
- < 0.4 → 视为"未匹配",按"找不到"处置

---

## 五、对底层 skill 的接口要求

- SKILL.md frontmatter `description` 必须场景化、含触发词
- SKILL.md 正文必须列出能力清单(create / copy / update / delete / query 等)
- references/ 下若有 cli-reference 类文档,顶部要有"功能总览"

---

## 六、约束

- [全量索引] 段是 agent 自动维护的,不直接编辑(路径变更场景紧急修正除外)
- 业务侧 SKILL.md 引用 `capability:xxx`,不允许出现 `skills/<path>` 硬编码
- 加新业务能力时:先检查索引是否已有对应 sub_capability,有则直接引用;无则报告需扩展底层
- 跨 agent 平台部署:本文件随业务包带走,新 agent 启动后重新扫描其 skills/ 目录,自动适配
