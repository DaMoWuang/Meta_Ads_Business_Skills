# Meta Ads Business Skills Package

Meta 广告业务侧 skill 包(可移植到任意 agent)。

## 包结构

```
Meta_Ads_Business_Skills/
├── README.md
├── BUSINESS_PACKAGE.md             # 打包清单 + 接入流程 + 自检
├── Meta广告执行QA.md                # 业务通用知识沉淀
│
├── project/
│   ├── capability-routing.md       # 能力路由表(全量索引,首次启动自动填充)
│   ├── skills/
│   │   ├── ad-creation-detector/   # 项目接入引导 + 日常需求检测主流程(自带 8 条铁律)
│   │   └── meta-ads-sheet-mapping/ # sheet ↔ Meta 字段映射方法论
│   ├── templates/                  # 业务表单 / cron 模板
│   ├── global/                     # 业务策略 / 品牌 anchor
│   └── instances/_template/        # 接入骨架
│
└── memory/
    └── discipline-lessons.md       # 业务纪律累积
```

## 接入流程

详见 [BUSINESS_PACKAGE.md](BUSINESS_PACKAGE.md)。

## 设计原则

- 自包含:8 条业务铁律内嵌在 [project/skills/ad-creation-detector/SKILL.md](project/skills/ad-creation-detector/SKILL.md) "自带政策"段
- 解耦:业务文档只引用 `capability:xxx`,底层 skill 重命名时业务侧零改动
- 自适配:[全量索引] 段为空,首次启动 agent 自动扫描该 agent 的 skills/ 目录填入
- 三层触发:关键词 + 语义理解 + Slash Commands(/onboard /check /create /copy /update /pause /report)
- 教训累积:[memory/discipline-lessons.md](memory/discipline-lessons.md) 启动加载,提醒过往偏差
