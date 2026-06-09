# BUSINESS_PACKAGE.md — 业务侧 skill 包打包清单

业务侧 skill 包 = 可独立分发给任意 agent 的、不依赖宿主工程级文档的、自包含的 skill 集合。

---

## 一、必须打包的文件

```
project/                                       # 业务流程 + 规则 + 实例
├── capability-routing.md                      # 路由层(自描述 + 自维护)
│
├── skills/
│   ├── ad-creation-detector/                  # 业务流程 skill(主)
│   │   ├── SKILL.md                           # 含"自带政策"段(自包含铁则)
│   │   ├── references/
│   │   │   ├── cron-registration.md
│   │   │   └── report-card-contract.md
│   │   └── scripts/
│   │       ├── fetch_sheet.py
│   │       └── report_card.cjs
│   │
│   └── meta-ads-sheet-mapping/                # 业务方法论 skill(辅)
│       ├── SKILL.md
│       └── references/
│           ├── api-params.md
│           ├── audience-introspection-method.md
│           ├── naming-introspection-method.md
│           ├── sheet-structure-introspection.md
│           └── troubleshooting.md
│
├── templates/                                 # 业务表单 / cron 模板
│   ├── ad-creation-form.md
│   └── cron-jobs.template.json
│
├── global/                                    # 业务全局
│   ├── SAFETY.md                              # 删除操作安全协议 + 自纠错例外
│   ├── 优化师策略库.md
│   └── brands/                                # 品牌 anchor(空目录)
│
└── instances/_template/                       # 接入骨架
    ├── instance.template.yaml
    ├── .onboarding_progress.template.yaml
    └── groups/_group_template/
        ├── group.template.yaml
        ├── audiences/
        ├── snapshots/
        ├── logs/
        ├── notes/
        └── registry.json

Meta广告执行QA.md                               # 业务通用知识沉淀
memory/discipline-lessons.md                   # 业务纪律累积
```

---

## 二、不打包的内容

```
[工程元层]
README.md / CONFIG.md / PACKAGING.md / AGENTS.md / SOUL.md / IDENTITY.md
USER.md / TOOLS.md / HEARTBEAT.md / memory/MEMORY.md / memory/README.md

[底层 skill — 由目标 agent 自带,业务侧通过 capability-routing 自动适配]
skills/(工程根)

[工程级脚本]
scripts/feishu-card.cjs / scripts/vh-auth-card.cjs / scripts/search-audience.sh
```

---

## 三、接入新 agent 的流程

### Step 0:污染自检(必跑)

业务包内不应出现宿主工程目录名的硬编码引用,否则改名 / 移植到其它工作区会失效。接入前在业务包根目录跑:

```bash
grep -rEn "Meta_Ads_Workspace|Meta_Ads_Business_Skills" \
  project/ memory/ Meta广告执行QA.md \
  --include="*.md" --include="*.yaml" --include="*.json" --include="*.py" --include="*.cjs" --include="*.sh"
# 预期无输出。
# 仅 README.md / BUSINESS_PACKAGE.md 自述类段落允许出现 Meta_Ads_Business_Skills(本包标题/打包指引),
# 业务包内的运行时文档(project/ memory/ 等)出现任一前缀即视为污染,需先修复再接入。
```

### Step 1:复制业务包到目标 agent 工作区,保持目录结构

### Step 2:确认目标 agent 已有底层 skill

业务侧需要以下 capability(详见 [project/capability-routing.md](project/capability-routing.md)):
- `capability:vh_meta_ads.*` — Meta API 调用
- `capability:feishu_native_card.*` — 飞书卡片
- `capability:vhcli_auth.*` — VH 平台授权 + 审计上报

目标 agent 必须有对应底层 skill(具体名称不限,SKILL.md 描述含相应能力即可)。

### Step 3:启动 agent

agent 自动执行:
1. read `project/capability-routing.md`
2. 全局扫描目标 agent 的 `skills/` 目录,语义匹配每个 capability
3. 写回 `[全量索引]` 段
4. 输出"路由报告"(各 capability 匹配的 skill 路径 + 信心分)

### Step 4:review 路由报告

- 信心分 > 0.8 → 直接可用
- 信心分 0.6 - 0.8 → 确认即可
- 信心分 < 0.6 → 检查目标 agent 是否缺底层能力

### Step 5:业务流程可用

用户用业务语言("关联账号" / "创建广告"等)触发,SKILL discovery 路由到 ad-creation-detector 执行。

---

## 四、变更场景

| 场景 | 处置 |
|---|---|
| 目标 agent 底层 skill 重命名 | 重启 agent 自动重扫,capability-routing 自动更新 |
| 目标 agent 加新底层能力 | 重启 agent,新能力自动入索引 |
| 业务侧加新业务流程 | 写新业务文档,引用 capability:xxx |
| 跨 agent 平台部署 | 复制业务包到新 agent,启动自动适配 |

---

## 五、发包前自检

```bash
# 1. 业务侧不应有 skills/ 路径硬编码引用
grep -rEn "skills/vh-meta-ads/|skills/vhcli/|skills/feishu-native-card/" project/ "Meta广告执行QA.md" memory/discipline-lessons.md 2>/dev/null

# 2. 业务侧不应有底层命令痕迹
grep -rEn '\$META ads|vhcli agent|graph\.facebook\.com|--access-token' project/ "Meta广告执行QA.md" 2>/dev/null

# 3. 业务侧不应有自写 API 调用
grep -rEn 'import requests.*facebook|curl.*facebook\.com|fetch.*facebook' project/ 2>/dev/null

# 4. 业务侧不应有工程级文档硬依赖
grep -rEn "TOOLS\\.md|AGENTS\\.md" project/ 2>/dev/null | grep -v "discipline-lessons\\.md"
```

四类检查全部为空 → 业务包合规,可分发。
