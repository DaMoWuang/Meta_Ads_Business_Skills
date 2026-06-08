# 常见问题与踩坑记录

> **本文档是什么:** Meta Marketing API **通用踩坑速查** — 跨任何业务都适用的物理约束 / 常见报错 / 修复方案。规则型条目(每条带"问题/原因/解决"三段),给 agent 创建前快速 review 用。
> **本文档不是什么:** 不装初次授权 / 功能调用 Q&A(去 [Meta广告执行QA.md](../../../../Meta广告执行QA.md));不装宏观投放策略 / 调整方向(去 [优化师策略库.md](../../../global/优化师策略库.md));不装项目本次创建的具体参数(去 group.yaml.strategy);不装 skill 自身的执行流程铁律(去对应 skill 的"安全规则"段)。
> **关联指向:** 12 条 API 层 safety rails 见 Meta广告执行QA.md;创建前/后强制 review 流程通过 `capability:vh_meta_ads.verify_pre_creation` + `capability:vh_meta_ads.verify_post_creation`(由 [capability-routing.md](../../../capability-routing.md) 路由)。

> 本文件是 Meta Marketing API 通用踩坑速查 — 所有项目都适用,不带项目专属内容。

## 1. saved_audience_id 不可直接使用

**问题**: Meta API 不支持在创建 ad set 时直接传 `saved_audience_id` 参数
**报错**: `#10 permission error`
**解决**: 先 `GET /{saved_audience_id}?fields=targeting` 获取完整定向,再将 targeting 内容作为参数创建 ad set

## 2. 设备定向(user_device) UI 不显示

**问题**: 通过 API 写入 `user_device` 后,Ads Manager 的 "Specific mobile devices" 仍显示 "all device"
**原因**: POST_ENGAGEMENT campaign 中,AA=OFF 时 UI 不展示 device targeting
**解决**:
- `targeting_automation.advantage_audience` 必须为 `1`(AA=ON)
- 必须设 Manual Placements(指定 publisher_platforms + positions)
- 如果修改无效,删除 ad set 重新创建(而非更新)

## 3. destination_type 缺失报错

**问题**: 创建 POST_ENGAGEMENT ad set 时报错
**解决**: 必须指定 `destination_type`:
- POST_ENGAGEMENT → `ON_POST`
- THRUPLAY → `ON_VIDEO`
- LINK_CLICKS → `WEBSITE`

## 4. IG explore_home 必须同时选 explore

**问题**: 单独选 `explore_home` 报错
**解决**: 选 `explore_home` 时必须同时包含 `explore`

## 5. Facebook 版位已废弃

**问题**: `video_feeds` 和 `reels`(在 facebook_positions 中)报错
**解决**:
- `video_feeds` → 已废弃,移除
- facebook 中的 reels → 用 `facebook_reels` 代替
- instagram 中的 reels → 仍用 `reels`

## 6. Lifetime Budget 必须设 end_time

**问题**: 使用 lifetime_budget 创建 campaign 时报错
**解决**: 必须在 ad set 或 campaign 层设置 `end_time`

## 7. 新机型不在 Meta 设备库

**问题**: 新发布的设备无法作为 user_device
**解决**:
- 通过逐个测试确认哪些设备名有效
- 有效格式:小写型号名(如 `<model_a>`, `galaxy <model>`, `<brand> <model>`)
- 无效的设备在 Meta 更新设备库前只能跳过
- 可用同品牌已有型号替代覆盖

## 8. POST_ENGAGEMENT ad 的 tracking_specs

**问题**: tracking_specs 中的 action.type 包含无效类型时报错
**解决**: POST_ENGAGEMENT 类型的 ad 不要包含 `commerce_event`,保留:
- `offsite_conversion` + fb_pixel
- `onsite_conversion` + fb_pixel
- `post_engagement` + page
- `link_click` + page

## 9. 表格 vs 在跑广告冲突

**铁则**: 创建广告时严格以表格定义为准,不经验主义地参考在跑广告
- 在跑广告可能有降级(如缺少 work_positions)
- 在跑广告可能版本不同(如 age 18-65 vs 表格定义的 18-40)
- 唯一例外:涉及 Meta UI 显示的 API 非标参数(如 user_device 需 AA=ON 才显示),由 [troubleshooting #2] 处理

## 10. CBO vs ABO 误用导致预算 N 倍超支

**问题:** 群里说"Lifetime + CBO,Campaign 级控制",但创建时:
- Campaign 上设了 `is_adset_budget_sharing_enabled=false`(默认 ABO)
- 又给每个 ad set 分配了 `<budget>` 预算
- 共 N 个 ad set → 实际花费 N × `<budget>`(预期只花 `<budget>`,被放大 N 倍严重超支)

**根因:** 创建前没读 `group.yaml.strategy.budget`(项目默认),直接用历史脚本拼参数,导致预算模式与项目策略不一致。

**解决(双闸):**
1. **创建前**(verify-and-dedup.md Step 0):必读 group.yaml.strategy + troubleshooting + Meta广告执行QA,在飞书表单上显式列出"预算模式 / 预算层级 / 出价策略"行,等用户对这一行确认
2. **创建后**(verify-and-dedup.md Step 3):立刻 GET campaign + adsets,校验 `is_adset_budget_sharing_enabled` 与预算位置(CBO 在 campaign / ABO 在 adset)是否符合预期,不一致立即删 ad set 重建

**API 参数对照:**

| 模式 | Campaign | Ad Set |
|---|---|---|
| CBO(默认推荐) | `is_adset_budget_sharing_enabled=true` + `lifetime_budget=$X` | 不传 budget |
| ABO | `is_adset_budget_sharing_enabled=false`(或不传) | 每个 adset 各传 budget |
