# 命名规则反推方法论

> 本文件描述 **agent 如何从一个新项目的 sheet + Meta 后台习得该项目的命名规范**。
> 不预设任何具体命名模板 —— 各项目命名约定由项目业务自定义。
>
> 想看一个 introspection 完成后的形态参考,接入第一个实例后会落到 `project/instances/{instance}/notes/naming-convention.md`(届时该实例**仅作形态参考,不可作为模板复制**)。当前 `project/instances/` 仅有 `_template/`。

---

## 何时使用

项目接入引导 A.6 命名规则反推 / 任何新项目接入 / 已接入项目命名规则疑似变化时。

---

## 输入

- 项目的 Google Sheet 链接(命名规范 sheet 通常叫 `Campaign name` / `命名规则` / 类似名)
- 项目对应 Meta 广告账户(`act_*`)的访问 token

---

## 反推流程(5 步)

### Step 1: 找到命名规范 sheet

在表格 tab 列表里通过关键词模糊匹配:`campaign name` / `naming` / `命名` / `rule`。

如多个 tab 含相关关键词,逐个抽 header 让用户确认哪个是真正的命名规范源。

### Step 2: 解析 segment 列表

读命名规范 sheet,识别:

- **横向 segment**: 表头每列代表一个命名 segment(如 Brand / Country / Platform / Product / ...)
- **纵向枚举值**: 每列下方枚举该 segment 的可选值
- **示例行**: 通常底部或单独 sheet 有完整命名示例

不预设 segment 列表(每个项目都不同)。

### Step 3: 拉历史 Meta campaign 反向印证

```bash
GET /act_{account_id}/campaigns?fields=id,name,objective&limit=200
```

把历史 campaign name 按候选分隔符(`_` / `-` / `|`)拆开,统计:

- 每个位置的取值分布 → 反推该位置对应哪个 segment
- 是否有固定前缀(如代理商缩写 / 品牌缩写)
- 是否存在多种命名格式(老广告 vs 新广告)

### Step 4: 与 sheet 定义比对

对照 sheet 定义的 segment 顺序与历史 name 拆解结果:

- 一致 → 命名规则稳定,直接采用
- 不一致 → 列出差异点,问用户哪个是当前 source of truth

### Step 5: 与用户确认拼接规则

向用户确认下面这些问题的答案(都不预设):

- 分隔符是什么?是否所有 segment 用同一分隔符?
- segment 顺序固定还是部分可省?
- 哪些 segment 必填、哪些可省?
- 日期格式是 MMDD 还是 YYYYMMDD?是否带分隔符?
- CreativeDesc 之类的自由文本怎么编码(驼峰 / 下划线 / 全小写)?
- Ad Set name 是否直接用 tier 名,还是另有规则?
- Ad name 是否与 Campaign / Ad Set name 联动?

---

## 输出

落到 `project/instances/{instance}/groups/{group}/group.yaml.strategy.naming_pattern`:

```yaml
strategy:
  naming_pattern:
    template: "{segment_a}_{segment_b}_..."          # 由本次反推确定
    segments:
      - name: segment_a
        source: "<sheet 列名 / 固定值 / 计算字段>"
        values: [...]                                  # 该项目实际枚举
      - name: segment_b
        ...
    separator: "_"
    examples:                                         # 至少 2-3 个该项目实际示例
      - "..."
      - "..."
```

软经验(踩坑、命名漂移、历史遗留)落 `project/instances/{instance}/notes/naming-convention.md`。

---

## 反直觉点(运行时判断,不预设)

不同项目可能出现以下任一情况,需在反推时识别并问用户:

- **品牌 segment 是否固定**: 部分项目品牌固定不写入 name,部分项目品牌随子品牌变化
- **平台 segment 是否区分 FB/IG**: 部分项目用 `FB` / `IG` 区分,部分用统一 `Meta`
- **同一 Campaign 下多 Ad 是否同名**: 部分项目所有 tier 共享一个 Ad name,部分项目每 Ad Set 一个独立 Ad name
- **历史命名漂移**: 老 campaign 可能用旧规则,新 campaign 用新规则,需问用户当前规则边界
