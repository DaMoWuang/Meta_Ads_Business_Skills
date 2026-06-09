---
name: meta-ads-safety-module
description: "Meta 广告删除操作安全协议的唯一权威。任何 delete (单个或批量) 前必读。其它操作 (改预算 / 改素材 / 改时间 / status 变更) 走各 skill 现有规则,不属于本文管辖。当以下情况时使用此文档:(1) 调任何 *_delete (2) 一次操作含 ≥3 个删除。"
---

# Meta 广告删除安全协议

> **本文档是什么:** 删除操作 (单个 + 批量 ≥3) 的分级、协议、审计、回滚方案的唯一权威。
> **本文档不是什么:** 不覆盖非删除操作 (改预算 / 改素材 / 改受众 / 改时间 / status 变更)— 那些走 vh-meta-ads/SKILL.md 安全规则 + ad-creation-detector 自带政策。
> **关联指向:** API 通用硬约束见 [Meta广告执行QA.md](../../Meta广告执行QA.md);skill 执行铁律由 `capability:vh_meta_ads.*`(由 [project/capability-routing.md](../capability-routing.md) 路由)对应底层 skill 维护;业务流程铁律见 [project/skills/ad-creation-detector/SKILL.md](../skills/ad-creation-detector/SKILL.md) 自带政策段。

---

## 一、覆盖范围

✅ 单个删除:`campaign_delete` / `adset_delete` / `ad_delete` / `creative_delete`
✅ 批量删除:一次操作含 ≥3 个删除
❌ 不覆盖:改预算 / 改素材 / 改受众 / 改时间 / status 变更

---

## 二、完整 RED 协议(6 步,缺一不可)

1. `get` 回读对象当前状态
2. `insights` 拉 `lifetime_spend` 快照
3. 飞书表单展示:before / 影响范围 / 回滚预案
4. 用户文字确认(第一次)
5. 用户二次确认:输入对象 ID 末 4 位,或"确认删除"
6. 删除 + `get` 验证 + 写 `high-risk-ops.jsonl` + `vhcli operate-record` 上报

---

## 三、自纠错例外(3 步轻量协议)

### 触发条件(4 条全中,缺一即退回完整 RED)

1. 对象本会话内创建(查 `registry.json` + 会话内创建日志)
2. status 始终为 PAUSED(历史无 ACTIVE)
3. `lifetime_spend == 0`(`insights` 拉一次确认)
4. 创建至今 ≤ 30 分钟

### 4 条全中 → 轻量协议

- Step 1:`get` 回读 + 列出 4 条触发条件的核查结果
- Step 2:对话中说明错误原因
- Step 3:用户单次文字确认 → 删除 + 写 `high-risk-ops.jsonl`(`reason: self_rollback`)

---

## 四、审计落盘

**路径:** `project/instances/{instance}/groups/{group}/logs/high-risk-ops.jsonl`

**schema(一行 JSONL):**

```json
{
  "ts": "<ISO8601>",
  "op": "<campaign_delete | adset_delete | ad_delete | creative_delete>",
  "object_id": "<id>",
  "object_type": "<campaign | adset | ad | creative>",
  "parent_id": "<parent id 或 null>",
  "lifetime_spend_snapshot": "<spend 数值 或 0>",
  "user_confirm_ref": "<飞书消息 ID 或 对话片段引用>",
  "reason": "<user_request | self_rollback>",
  "result": "<success | failed>",
  "error": "<错误信息,可选>"
}
```

---

## 五、回滚预案

| 操作 | 回滚方法 |
|---|---|
| `campaign_delete` | 从 `registry.json` 重建 campaign + adset + ad + creative 链 |
| `adset_delete` | 从 `registry.json` 重建 adset + ad |
| `ad_delete` | 从 `registry.json` 重建 ad(creative 不动) |
| `creative_delete` | 不可恢复,需重新上传素材 |

---

## 六、模型自检(内部执行,不输出对话,除非用户主动询问)

任何 delete 执行前 agent 在内部明确以下三问:

1. 走完整 RED 还是自纠错?自纠错 4 条触发条件是否全中?
2. 误删如何回滚?(对照 §五)
3. 用户授权出处?(用户消息原文 / 自纠错对话片段)

任一问无明确答案 → 停手,回到 §二 起点。

---

## 七、脚本接口预留

供后续 `scripts/guard_meta_op.py` 机读使用。

- **输入:** meta CLI 完整命令字符串 + `session_id`
- **tier 判定:** 命令含 `delete` → RED
- **自纠错检测:** 查会话内创建日志 + `registry.json` 时间戳 + `insights` spend
- **输出:** `{tier, requires_confirm, audit_path, exception?: "self_rollback"}`
- **退出码:** `0`=放行 / `10`=需用户确认 / `20`=拒绝
