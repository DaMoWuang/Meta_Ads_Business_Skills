# Cron 注册 SOP — 项目接入引导.10 步执行指南

> **本文档是什么:** 项目接入引导 走到 A.10 cron 注册时,agent 应执行的标准化操作流程。
> **本文档不是什么:** 不装 cron job 的 JSON 结构(去 [templates/cron-jobs.template.json](../../../templates/cron-jobs.template.json));不装时间点 / 时区 / 规则的具体值(那些来自 [instance.yaml.schedule](../../../instances/_template/instance.template.yaml));不装 openclaw 平台 cron 调度器实现细节(平台层,工程外)。
> **关联指向:** 项目接入引导 流程见 [SKILL.md](../SKILL.md);时间表与卡片颜色规则见 SKILL.md "定时任务规则" 节;报告卡片数据契约见 [report-card-contract.md](report-card-contract.md)。

---

## A.10 触发条件与是否可选

- **默认必走** — 项目接入引导 走完 A.0–A.9 后,A.10 是收尾必做步骤,manifest 中 `A.10_cron.status` 必须从 pending 推进至 done
- **用户明确表态可跳过** — 若用户表示"暂不启用定时检测"或同义表达,标记 `A.10_cron.status = "skipped"`,在 manifest.note 字段记录跳过原因
- **跳过即放弃自动检测** — 日常需求检测 仍可由用户手动触发(在群内发送"触发检测"或同义指令),但不会按时间点自动执行

---

## 标准操作流程(7 步)

### Step 1: read 输入

- read `project/instances/{instance}/instance.yaml` → 取 `schedule.{check_times, timezone, rules, weekly_consolidation}`
- read `templates/cron-jobs.template.json` → 取占位符与 job 模板结构
- read `~/.openclaw/cron/jobs.json`(若不存在视为 `{"jobs": []}`)

### Step 2: 生成 instance 检测 jobs(每个 check_time 一条)

**前置判定:** 检查 `instance.yaml.detection_sources` 中是否至少一个 `enabled=true`:
- 至少一个 enabled → 继续生成 instance check jobs
- 全部 enabled=false → **跳过本步**,直接进入 Step 3 仅注册 weekly_*(因为没有数据源可定时检测)

对 `schedule.check_times` 中每个时间点 `HH:MM`,按 `_template_per_instance_check_time` 生成一条 job:

- 替换占位符:`{instance}` / `{time_tag}=hhmm`(如 10:10→1010) / `{HH:MM}` / `{minute}` / `{hour}` / `{timezone}` / `{rule_text}`(从 `schedule.rules[HH:MM]`)/ `{command}`(按 openclaw 实际机制替换)
- `id` 必须满足 `ad_check_{instance}_{time_tag}` 格式 — **去重依据**

### Step 3: 生成工程级周 cron(若启用且未注册)

若 `schedule.weekly_consolidation.enabled = true`:
- 检查 `~/.openclaw/cron/jobs.json` 是否已含 `weekly_qa_consolidation` 条目 — 不存在则按 `_template_weekly_qa_consolidation` 生成
- 检查是否已含 `weekly_strategy_consolidation` 条目 — 不存在则按 `_template_weekly_strategy_consolidation` 生成

> 注意:weekly_* 是**工程级单例**,跨 instance 复用,不按 instance 重复添加。第一个接入的 instance 注册即可,后续接入的 instance 不重复添加。

### Step 4: 合并写入 ~/.openclaw/cron/jobs.json

- 模式:**patch / merge**,不是覆盖
- 同 `id` 已存在 → 用新内容覆盖该条(更新),不要并存两条同 id
- 不同 `id` 直接 append
- 保留其他无关 job 不动

### Step 5: 验证

- 重新 read `~/.openclaw/cron/jobs.json`
- 校验:本 instance 的 `ad_check_{instance}_*` 数量 = `schedule.check_times` 长度
- 校验:若 weekly 启用,`weekly_qa_consolidation` + `weekly_strategy_consolidation` 各存在 1 条
- 校验通过 → patch manifest:`A.10_cron.status = "done"`,`completed_at = <now>`

### Step 6: 失败处置(智能归因)

- **写权限不足**(无法写入 `~/.openclaw/cron/jobs.json`)→ 报告用户具体路径,不重试,manifest 标记 `blocked`
- **同 id job 冲突且 patch 失败** → 报告冲突项,询问用户保留哪一条
- **cron daemon 未运行**(jobs.json 已写入但调度未生效)→ 注册成功但提示用户启动 daemon,不计为 A.10 失败
- **用户明确表态跳过** → 标记 `A.10_cron.status = "skipped"`,note 字段记录原因,不触发归因

### Step 7: 报告

A.10 完成后,在项目接入引导 收尾汇总报告中显示对应行:

```
| A.10 cron 注册 | 已完成 | N 条 instance check + 2 条 weekly(若启用) |
```

或跳过时:
```
| A.10 cron 注册 | 已跳过 | 原因:<用户给出的原因> |
```

---

## 跨 instance 注意事项

| 场景 | 处理 |
|---|---|
| **首个 instance 接入** | 生成 instance jobs + weekly_* 全部 |
| **第 N 个 instance 接入(N≥2)** | 只生成 instance jobs;weekly_* 已存在,跳过 |
| **删除某 instance** | 在 jobs.json 中按 `ad_check_{instance}_*` 前缀清理该 instance 的 jobs;weekly_* 不动 |
| **修改某 instance 的 schedule** | 按新 schedule 重生成该 instance 的 jobs,patch 覆盖原条目 |

---

## 与平台层的边界

- **本 SOP 管理的范围:** jobs.json 文件内容的标准化结构与生成流程
- **不在本 SOP 范围内的:** openclaw 平台 cron daemon 是否运行 / 调度精度 / 调度日志 — 属于平台运行时,工程文档不介入
- **`{command}` 占位符如何替换:** 由 agent 在落地时 read 平台说明或询问用户,把 `{command}` 替换为 openclaw 实际可执行的命令格式(可能是 skill 直调,也可能是 shell 命令)。模板其他字段(id / schedule_cron / timezone / params / enabled / description)结构跨平台稳定。
