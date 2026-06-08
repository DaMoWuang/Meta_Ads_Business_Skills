# Meta 广告执行 Q&A

> **本文档是什么:** 接入授权 + 功能调用层的 Q&A 速查 — token 怎么拿 / CLI/API 怎么调 / 飞书卡片怎么发 / Meta API 调用错误如何排查 / 13 条 API 层 safety rails 来源。给"操作-接入"层做问答查询。
> **本文档不是什么:** 不装品牌 / 业务 / 广告优化型 Q&A(那些是策略层,去 [优化师策略库.md](project/global/优化师策略库.md));不装 skill 自身的执行流程铁律(去对应 skill 的"安全规则"段);不装 Meta API 通用踩坑速查(规则型,去 [troubleshooting.md](project/skills/meta-ads-sheet-mapping/references/troubleshooting.md))。
> **关联指向:** 13 条 safety rails 在本文顶部;创建/修改时的 skill 流程铁律由 `capability:vh_meta_ads.*` 内部声明的执行路径管理(详见 [project/capability-routing.md](project/capability-routing.md));通用踩坑去 troubleshooting.md;宏观投放策略去 优化师策略库.md。

> 定期总结广告执行过程中遇到的问题和解决方案,为后续迭代沉淀资产。

## ⚠️ 关键约束(13 条 safety rails 来源)

本文沉淀的是 **Meta API 硬约束**,跨任何业务通用,因此放工程根而非具体 instance/group。下列硬规则必须遵守:

1. **所有创建一律 PAUSED** — Campaign / Ad Set / Ad,人工开启
2. **AA=ON 时 `age_max` 必须 65** — Meta 强制要求
3. **POST_ENGAGEMENT 必须 `destination_type=ON_POST`** — 否则 Ad 创建报 1487888
4. **THRUPLAY 必须 `destination_type=ON_VIDEO`** — 否则报"website URL 必填"
5. **Lifetime Budget 必须设 `end_time`** — 至少 start_time + 24h
6. **`saved_audience_id` 不可直接传** — 先 `GET /{id}?fields=targeting`,把 targeting 作为参数传入创建接口
7. **IG `explore_home` 必须同时包含 `explore`** — 版位组合校验
8. **POST_ENGAGEMENT 优化目标须用 Ad Set Copy API 创建** — 直接 create 报 2490408
9. **预算/出价修改需用户二次确认** — 涉及花钱
10. **不得自动开启投放** — 禁止 update status=active 除非用户明确反复要求
11. **Token 失效必须重走授权** — 严禁用记忆/缓存数据冒充实时查询
12. **创建前必须解析意图返回参数摘要** — 用户明确确认后才执行
13. **删除操作需先向用户确认** — Campaign/Ad Set/Ad/Creative 删除均不可静默

下文按问题日期登记具体 case,作为 13 条规则的支撑证据。

---

## 问题记录

### 2026-05-21 | POST_ENGAGEMENT 无法直接创建 Ad Set
- **问题描述**：在 OUTCOME_ENGAGEMENT objective 的 campaign 下，通过 API 直接创建 optimization_goal=POST_ENGAGEMENT 的 ad set 会报错（error_subcode 2490408，"成效目标不可用"）
- **解决方案**：使用 Meta Ad Set Copy API（`POST /{source_adset_id}/copies`）从已有 ad set 复制，能完整保留 POST_ENGAGEMENT 设置

---

### 2026-05-21 | saved_audience_id 不可用
- **问题描述**：创建 ad set 时传入 `saved_audience_id` 参数会返回 #10 permission error，误以为是 App 权限不足
- **解决方案**：Meta API 设计上就不支持直接传 saved_audience_id。正确做法：先 `GET /{saved_audience_id}?fields=targeting` 获取完整定向信息，再将 targeting 作为参数传入创建接口。第三方工具（如虾）内部也是先读后写。

---

### 2026-05-21 | THRUPLAY Ad Set 创建报 "website URL 为必填信息"
- **问题描述**：创建 THRUPLAY optimization 的 ad set 后，绑定含视频链接的 creative 时报错要求 website URL
- **解决方案**：创建 ad set 时必须指定 `destination_type=ON_VIDEO`。正确参数组合：optimization_goal=THRUPLAY + billing_event=THRUPLAY + destination_type=ON_VIDEO

---

### 2026-05-21 | AA=ON 时 age_max 必须设为 65
- **问题描述**：开启 Advantage+ Audience (AA=ON) 后，如果 age_max < 65 会报错"年龄上限低于阈值"
- **解决方案**：AA=ON 时强制设 age_max=65（Meta 要求），saved audience 中的原始年龄范围（如18-35）作为"种子信号"被 Meta 参考

---

### 2026-05-21 | IG explore_home 需同时选择 explore
- **问题描述**：Instagram 版位中选择 explore_home 但未选择 explore 时报错
- **解决方案**：instagram_positions 中如果包含 explore_home，必须同时包含 explore

---

### 2026-05-21 | Lifetime Budget 必须设 end_time
- **问题描述**：使用 lifetime_budget 的 campaign 下创建 ad set 不设 end_time 会报错
- **解决方案**：end_time 必须设置且至少在 start_time 之后 24 小时

---

## 模板

### YYYY-MM-DD | 问题标题
- **问题描述**：（具体描述遇到的问题、错误信息）
- **解决方案**：（最终的解决方法、正确参数/流程）
