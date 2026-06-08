# 检测报告通用文案模板(占位符)

> 本文件是 detection 报告**通用文案占位模板**(纯文本备用,适用于飞书卡片底层 fallback)。
> 飞书原生交互卡片的实际渲染由 `scripts/report_card.cjs` 处理(用户已 lock 不动)。
>
> 项目级实际渲染样式记录在 `project/instances/{instance}/notes/report-template.md`(已接入实例的 introspection 结果),不可作为模板复制。

---

## 占位符约定

| 占位符 | 含义 |
|---|---|
| `{instance}` | instance_id (如 brand-country-key) |
| `{date}` `{time}` | 报告日期 / 时间 |
| `{group_a}` `{group_b}` ... | 分组名(产品 / 素材类型 / 投放阶段,由项目业务定义) |
| `{tab_a}` `{tab_b}` ... | 各 group 对应 detection 源 tab 名 |
| `{*_done}` `{*_link}` `{*_pending}` `{*_cancel}` | 各 group 状态统计 |
| `{*_new}` | 各 group 新增条数 |
| `{new_items_*}` | 各 group 新增条目明细 |
| `{new_count}` | 全局新增总数 |
| `{next_time}` | 下次检测时间 |
| `{anomaly_type}` `{anomaly_detail}` | 异常类型 / 详情 |

---

## 模板 A:有新增时

```
🔔 {instance} 新增广告检测 | {date} {time}

━━━━━━━━━━━━━━━━━━━━━━━

🆕 发现新增 {new_count} 条

┌─ {group_a} ─────────────────┐
│ 🆕 {a_new}条新增待创建      │
│ {new_items_a}              │
│                            │
│ 📊 全局: Done {a_done} | Link {a_link} | 待补 {a_pending} │
└────────────────────────────┘

┌─ {group_b} ─────────────────┐
│ 🆕 {b_new}条新增待创建      │
│ {new_items_b}              │
│                            │
│ 📊 全局: Done {b_done} | Link {b_link} | 待补 {b_pending} │
└────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━
⏭ 下一步: 生成创建确认表单
```

## 模板 B:无新增时(10:10 / 15:00 / 18:30 三档统一发)

```
📊 {instance} 日终报告 | {date}

━━━━━━━━━━━━━━━━━━━━━━━
📭 无新增任务
━━━━━━━━━━━━━━━━━━━━━━━

{group_a} ({tab_a})
├ ✅ Done     {a_done}
├ 🔗 有Link   {a_link}
├ ⬜ 待补Link  {a_pending}
└ ❌ 取消      {a_cancel}

{group_b} ({tab_b})
├ ✅ Done     {b_done}
├ 🔗 有Link   {b_link}
├ ⬜ 待补Link  {b_pending}
└ ❌ 取消      {b_cancel}

━━━━━━━━━━━━━━━━━━━━━━━
🕒 下次检测: {next_time}
```

## 模板 C:已废弃(原 10:30 / 15:00 静默版)

> 2026-05-29 调整:三档统一发送,无静默档。无新增时一律使用模板 B。

## 模板 D:异常时

```
⚠️ {instance} 检测异常 | {date} {time}

━━━━━━━━━━━━━━━━━━━━━━━

{anomaly_type}:
{anomaly_detail}

━━━━━━━━━━━━━━━━━━━━━━━
🛑 已暂停自动检测,等待确认
请回复确认处理方式:
1️⃣ 更新规则配置
2️⃣ 忽略本次异常继续
```

---

## 新增条目展示格式

单条新增:
```
  • {date} | {content} | ${budget}
    🔗 {link_short}
```

多条新增用紧凑表格:
```
  │ 日期    │ 素材       │ 预算  │
  │ {date1} │ {content1} │ ${b1} │
  │ {date2} │ {content2} │ ${b2} │
```

## 变更预警展示

```
⚠️ 变更预警 {count} 条:
  • Row{n}: "{old_content}" → "{new_content}"
  • Row{n}: Budget ${old} → ${new}
```
