# Meta API 参数速查

> 本文件是 Meta Marketing API 通用速查 — 所有项目都适用,**不带任何项目专属示例**。
> 项目个性化字段值(命名、tier 名、设备列表、custom_audiences 等)由 introspection 习得,落 instance / group 文件。

## Campaign 创建

```python
POST /act_{account_id}/campaigns
{
    "name": "<按项目命名规则拼接>",
    "objective": "<OUTCOME_ENGAGEMENT / OUTCOME_AWARENESS / OUTCOME_TRAFFIC / ...>",
    "buying_type": "AUCTION",
    "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
    "lifetime_budget": <amount_in_cents>,           # $1 = 100 cents
    "special_ad_categories": [],
    "status": "PAUSED"                              # safety rail #1: 始终 PAUSED
}
```

## Ad Set 创建

```python
POST /act_{account_id}/adsets
{
    "campaign_id": "{campaign_id}",
    "name": "<tier_name>",                          # 项目自定义 tier 名
    "optimization_goal": "<POST_ENGAGEMENT / THRUPLAY / LINK_CLICKS / ...>",
    "billing_event": "<IMPRESSIONS / THRUPLAY / LINK_CLICKS / ...>",
    "destination_type": "<ON_POST / ON_VIDEO / WEBSITE / ...>",
    "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
    "targeting": { ... },                            # 见下方 targeting 结构
    "status": "PAUSED",
    "start_time": "<ISO8601>",
    "end_time": "<ISO8601>"
}
```

## Targeting 结构

### 兴趣 / 行为定向(标准用法)
```json
{
    "geo_locations": {"countries": ["<CC>"], "location_types": ["home", "recent"]},
    "age_min": 18,
    "age_max": 40,
    "genders": [0],
    "flexible_spec": [
        {
            "interests": [{"id": "...", "name": "..."}],
            "behaviors": [{"id": "...", "name": "..."}],
            "work_positions": [{"id": "...", "name": "..."}],
            "work_employers": [{"id": "...", "name": "..."}]
        }
    ],
    "targeting_automation": {"advantage_audience": 0}
}
```

### 设备定向(非标用法)
```json
{
    "geo_locations": {"countries": ["<CC>"], "location_types": ["home", "recent"]},
    "age_min": 18,
    "age_max": 65,
    "user_device": ["<device_model_1>", "<device_model_2>", "..."],
    "user_os": ["Android"],
    "device_platforms": ["mobile", "desktop"],
    "publisher_platforms": ["facebook", "instagram"],
    "facebook_positions": ["feed", "facebook_reels", "facebook_reels_overlay", "profile_feed", "instream_video", "marketplace", "story", "search"],
    "instagram_positions": ["stream", "story", "reels"],
    "brand_safety_content_filter_levels": ["FACEBOOK_RELAXED"],
    "targeting_automation": {"advantage_audience": 1}
}
```

**关键约束**: 使用 `user_device` 时必须 `targeting_automation.advantage_audience=1` + `age_max=65` + Manual Placements,否则设备列表在 Ads Manager UI 中不显示!

### 再营销定向(Custom Audience)
```json
{
    "geo_locations": {"countries": ["<CC>"], "location_types": ["home", "recent"]},
    "age_min": 18,
    "age_max": 40,
    "custom_audiences": [{"id": "...", "name": "..."}, ...],
    "targeting_automation": {"advantage_audience": 0}
}
```

## Ad 创建

```python
POST /act_{account_id}/ads
{
    "adset_id": "{adset_id}",
    "name": "<creative_name>",
    "status": "PAUSED",
    "creative": {"object_story_id": "{page_id}_{post_id}"},
    "tracking_specs": [
        {"action.type": ["offsite_conversion"], "fb_pixel": ["{pixel_id}"]},
        {"action.type": ["onsite_conversion"], "fb_pixel": ["{pixel_id}"]},
        {"action.type": ["post_engagement"], "page": ["{page_id}"]},
        {"action.type": ["link_click"], "page": ["{page_id}"]}
    ]
}
```

## Saved Audience 读取方式

```python
# 不能直接传 saved_audience_id! 必须先读后写
GET /{saved_audience_id}?fields=id,name,targeting
# → 取出 targeting 内容,写入 ad set 的 targeting 字段
```

## optimization_goal 对照表

| 表格语义 | optimization_goal | billing_event | destination_type |
|---------|------------------|---------------|-----------------|
| video / videoview | THRUPLAY | THRUPLAY | ON_VIDEO |
| post / postengagement | POST_ENGAGEMENT | IMPRESSIONS | ON_POST |
| website / traffic | LINK_CLICKS | LINK_CLICKS | WEBSITE |

## 预算

- 单位:美分(cents)
- $50 → 5000, $100 → 10000, $200 → 20000, $300 → 30000
- CBO 模式:预算设在 campaign 层级,自动分配到 ad sets
- Lifetime Budget 必须设 end_time
