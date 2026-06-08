# 受众解码方法论

> 本文件描述 **agent 如何从一个新项目的 Meta 后台 saved_audiences + 受众定义 sheet 习得该项目的 tier 列表与每个 tier 的 targeting**。
> 不预设任何 tier 名称(T1_xxx / T2_xxx 完全由项目业务自定义)。
>
> 想看一个 introspection 完成后的形态参考,接入第一个实例后会落到 `project/instances/{instance}/groups/{group}/notes/audience-definition.md`(届时该实例**仅作形态参考,不可作为模板复制**)。当前 `project/instances/` 仅有 `_template/`。
>
> ⚠️ **同品牌不同国家、同国家不同产品都不通用**,每个 group 都必须重新走完本流程。

---

## 何时使用

项目接入引导 A.7 受众解码 / 任何新 group 接入 / 已接入 group 受众疑似变化(saved_audience 重命名、新增 tier)时。

---

## 输入

- 项目的 Google Sheet 链接(受众定义 sheet 通常叫 `Meta audience list` / `FB audience` / `受众列表` / 类似名)
- 项目对应 Meta 广告账户的访问 token
- 历史 campaign id 列表(若存在,用于反向印证)

---

## 解码流程(6 步)

### Step 1: 找到受众定义 sheet

通过关键词模糊匹配:`audience` / `受众` / `targeting` / `tier`。

### Step 2: 逐 tier 解析 sheet 内的语义描述

读受众定义 sheet 每一行 / 每一组,记录:

- tier 名(项目自定义,不预设)
- 定向类型(兴趣 / 行为 / 设备 / Custom Audience / Lookalike / ...)
- 具体内容描述(兴趣标签名、行为标签名、设备型号列表、CA 名等)
- 年龄、性别、地域(若 sheet 有声明)

### Step 3: 拉 Meta 后台 saved_audiences

```bash
GET /act_{account_id}/saved_audiences?fields=id,name,targeting&limit=200
```

模糊匹配 sheet 中 tier 名 → saved_audience name:

- 名字完全一致 → 直接绑定
- 名字部分一致(如 sheet `<tier_name>` vs 后台 `<tier_name>-<suffix>`,后缀可能是年份/版本号) → 列出候选让用户确认
- 名字完全不一致但语义相同 → 由 sheet 描述推断,问用户

### Step 4: 拉历史 Ad Set targeting 反向印证

```bash
# 取若干历史 campaign 下所有 ad set
GET /{campaign_id}/adsets?fields=id,name,targeting,optimization_goal,...
```

按 ad set name 关联到 tier,核对 targeting 内容是否与 sheet 描述一致:

- 一致 → 该 tier 历史投放配置稳定
- 不一致 → 可能存在降级 / 漂移,以 sheet 为准,但记录差异让用户判断

**铁则**: 创建广告时严格以 **sheet 为准**,不经验主义地复制在跑广告(在跑广告可能因 Meta 设备库延迟、saved_audience 升级等原因与 sheet 定义不同)。

### Step 5: 处理特殊定向类型

下列定向类型在 Meta API 上有非标行为,**是否使用由该项目决定**(不预设):

| 定向类型 | Meta API 字段 | 注意事项 |
|---|---|---|
| 兴趣 / 行为 | `flexible_spec[].interests` / `behaviors` | 标准用法 |
| 职位 / 雇主 | `flexible_spec[].work_positions` / `work_employers` | 标准用法 |
| 自定义受众 | `targeting.custom_audiences` | 需先在账户内创建 CA |
| Lookalike | `targeting.custom_audiences`(LAL 也属 CA) | 同上 |
| **设备定向** | `targeting.user_device` | **非标填写**;需 AA=ON + Manual Placements + age_max=65 才在 Ads Manager UI 显示设备列表;新机型可能在 Meta 设备库延迟收录 |
| 地域 | `targeting.geo_locations` | 国家 / 城市 / 邮编 / 半径多种粒度 |

如该项目 tier 中包含设备定向,务必在 group 级 notes 中记录设备列表与 Meta 设备库可用情况。

### Step 6: 与用户确认 tier 与 targeting JSON

逐 tier 输出预览:

```
T?_<tier_name>
  类型: <interests / behaviors / device / CA / mixed>
  内容: <从 sheet + saved_audience 解码的具体内容>
  Ad Set 通用参数: optimization_goal=?, billing_event=?, destination_type=?, AA=?
```

用户确认后落 JSON。

---

## 输出

每个 tier 一个 JSON 文件:

```
project/instances/{instance}/groups/{group}/audiences/{tier_name}.json
```

JSON 内容是该 tier 完整的 Meta API targeting payload(可直接传给 `/act_*/adsets`):

```json
{
  "geo_locations": {...},
  "age_min": ...,
  "age_max": ...,
  "genders": [...],
  "flexible_spec": [...],
  "custom_audiences": [...],
  "user_device": [...],
  "targeting_automation": {"advantage_audience": 0 或 1}
}
```

group 级软经验落 `groups/{group}/notes/audience-definition.md`(年龄/性别/语言通用配置、tier 之间的关系、特殊踩坑)。

group.yaml 的 `strategy.audiences.tiers` 仅记录 tier 索引(名字 + 文件路径 + 类型摘要),不复制完整 JSON。

---

## 反直觉点(运行时判断,不预设)

- **tier 数量与命名**: 项目不同差异极大(可能 3 tier、可能 9 tier);新 group 必须重新清点
- **同品牌不同国家不通用**: 即使是同一品牌,每个国家的兴趣库、custom_audiences、saved_audiences 都是独立的
- **同国家不同产品不通用**: 同一国家不同产品(同一品牌的两条产品线)tier 列表可能完全不同
- **saved_audience 命名漂移**: 后台 saved_audience 可能在升级时改名,需对比创建/更新时间
- **API 不支持直接传 saved_audience_id**: 必须先 `GET /{saved_audience_id}?fields=targeting` 拿到完整 targeting 内容再写入 ad set
