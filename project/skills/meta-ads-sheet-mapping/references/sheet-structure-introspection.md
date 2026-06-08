# Sheet 结构识别方法论

> 本文件描述 **agent 如何从一个新项目的 Google Sheet 自动识别各 tab 的语义角色与列含义**。
> 不预设任何 tab 名 / 列 index / header 行号 —— 这些在每个项目都不一样。
>
> 想看一个 introspection 完成后的形态参考,接入第一个实例后会落到 `project/instances/{instance}/groups/{group}/notes/sheet-structure.md`(届时该实例**仅作形态参考,不可作为模板复制**)。当前 `project/instances/` 仅有 `_template/`。

---

## 何时使用

项目接入引导 A.5 sheet 结构识别 / 任何新项目接入 / 已接入项目 sheet 结构疑似变化(加列、改列位置、tab 重命名)时。

---

## 输入

- 项目的 Google Sheet 链接

---

## 识别流程(5 步)

### Step 1: 列出全部 tab

```bash
# 通过 gviz 拉 sheet 元信息,或读 spreadsheet meta
curl -sL "https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&headers=0&sheet={tab_name}"
```

记录每个 tab 的名字 + gid(后续 detection / backfill 都用 gid 锁定)。

### Step 2: 抽 header + 前 10 行样本

每个 tab 抽前 10 行,识别:

- header 在第几行(可能是第 1 行,也可能是第 2-3 行,部分项目第 1 行是大标题)
- 是否有 sub-header(双行表头,合并单元格)
- data 从第几行开始

### Step 3: 给 tab 打语义标签

通过 header + 数据特征推断 tab 的角色:

| 候选语义 | 识别特征 |
|---|---|
| 命名规范 sheet | header 含 brand / country / platform / product / objective / phase / 命名 / segment 等关键词 |
| 受众定义 sheet | header 含 audience / tier / interest / behavior / targeting / 受众 等关键词 |
| 排期 / Media Plan / detection 源 | header 含 date / content / budget / link / 日期 / 素材 / 预算 / 链接 等关键词;每行代表一条具体广告 |
| 实际 campaign 列表 | 含 campaign_id / campaign name / 实际投放数据 |
| 回填目标 sheet | 与命名规范 sheet 同结构但有 status 列、有空行供新增 |
| 素材追踪 sheet | header 含 content / status / new / 新素材 等关键词,与 detection 源不同 tab 但语义相近 |

如多个 tab 命中同一语义,逐个让用户确认哪个是当前 source of truth。

### Step 4: 列语义识别(每个 tab)

对每列做语义识别(不硬编码列号,每个项目都不同):

| 目标字段 | 关键词候选(中英文混合) |
|---|---|
| 日期 | Date / 日期 / Schedule / Time / 排期 |
| 产品型号 | Product / 产品 / Model / 型号 |
| 素材内容 | Content / Creative / 素材 / Description / 内容 |
| 素材类型 | Type / Format / 类型 / Media type |
| 预算 | Budget / $ / 预算 / Cost |
| 链接 | Link / URL / 链接 / Post / Facebook |
| 排期开始 | Start / 开始 |
| 排期结束 | End / 结束 / Duration / 截止 |
| 优先级 | Priority / 优先级 / P0 / P1 |
| 状态标记 | Status / 状态 / Note / 备注 / Released |

值模式辅助识别:

- 日期列:形如 `MM.DD` / `MM-DD` / `YYYY-MM-DD` / `MM.DD HH:MM`
- 预算列:含 `$` / 数字 / `USD` / `CNY`
- 链接列:含 `http` / `facebook.com` / `fb.com`
- 状态列:取值有限枚举(`done` / `cancel` / 空)

### Step 5: 与用户确认 detection rule

不同项目对"什么算新增广告"定义不同(参见 `project/ad-creation-detector` 项目接入引导 引导)。问用户:

- detection 源在哪个 tab?
- 哪些列组合代表"就绪可创建"?(常见:Budget 有值 + Link 有值;但也可能仅 Link 有值就算)
- 哪些列代表"已完成 / 已取消",这些行需要排除?
- 取消标记在哪一列、什么值?

---

## 输出

落到 `project/instances/{instance}/groups/{group}/group.yaml.detection`:

```yaml
detection:
  sheet:
    spreadsheet_id: "..."
    tab_name: "..."           # 该项目实际 tab 名
    gid: ...
    header_row: ...           # 该项目实际 header 行号
    sub_header_row: ...
    data_start_row: ...
  column_map:                 # 列语义识别结果
    date: {index: ..., header_match: "..."}
    content: {index: ..., header_match: "..."}
    budget: {index: ..., header_match: "..."}
    creative_link: {index: ..., header_match: "..."}
    note_status: {index: ..., header_match: "..."}
    # ...其他识别出的列
  detection_rule: |           # 该项目的就绪判定表达式
    creative_link != '' AND budget != '' AND note_status not in ['done', 'cancel']
  naming_reference:           # 命名规范 sheet 指针
    tab_name: "..."
    gid: ...
  backfill_target:            # 回填目标 sheet 指针(若存在)
    tab_name: "..."
    gid: ...
  audience_reference:         # 受众定义 sheet 指针
    tab_name: "..."
    gid: ...
```

软经验(双 tab 同名易混淆、列偶尔变化、特殊空值约定)落 `groups/{group}/notes/sheet-structure.md`。

---

## 反直觉点(运行时判断,不预设)

- **header 行号每项目不同**: 不要硬编码第 1 行。可能是 1 / 2 / 3,或带 sub_header
- **detection 源 tab 名可能"变"**: 业务方可能按月/按 phase 新建 tab,detection 源指针需周期性核对
- **同 spreadsheet 内可能有同名但不同 gid 的 tab**: 用 gid 锁定,name 仅辅助识别
- **content 列可能跨多列**: 部分项目 col[4] 是简称、col[5] 是完整描述;两列都需读取,fallback 处理
- **Link 列从空变为有值 = 新增**: 不仅"新增行"算新增,"已有行 Link 列从空填值"也算
- **取消标记位置不固定**: 可能在专门的 status 列,也可能在 note 列模糊出现(包含 `cancel` 字样即可)
