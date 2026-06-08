const lark = require('/root/.openclaw/npm/node_modules/@larksuiteoapi/node-sdk');
const { readFileSync, readdirSync, existsSync } = require('node:fs');

function loadCreds() {
  const cfg = JSON.parse(readFileSync(process.env.HOME + '/.openclaw/openclaw.json', 'utf8'));
  const f = cfg.channels.feishu;
  return { appId: f.appId, appSecret: f.appSecret };
}

const client = new lark.Client({ ...loadCreds(), disableTokenCache: false });

/**
 * 自动发现所有项目配置
 * 扫描 project/instances/ 目录下所有含 instance.yaml 的 instance,
 * 然后逐 instance 扫描 groups/{group}/group.yaml
 */
function discoverProjects() {
  const projectsDir = process.env.WORKSPACE_ROOT
    ? `${process.env.WORKSPACE_ROOT}/project/instances`
    : `${process.cwd()}/project/instances`;
  const projects = [];

  if (!existsSync(projectsDir)) return projects;

  for (const dir of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    if (dir.name.startsWith('_')) continue; // 跳过 _template
    const instanceYaml = `${projectsDir}/${dir.name}/instance.yaml`;
    if (!existsSync(instanceYaml)) continue;

    projects.push({
      id: dir.name,
      instance_yaml: instanceYaml,
      path: `${projectsDir}/${dir.name}`
    });
  }
  return projects;
}

/**
 * 构建多项目汇总报告卡片
 * @param {Array} projectReports - [{project_id, country, products:[{name, stats, new_items}]}]
 */
function buildMultiProjectCard(projectReports) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // 计算总新增
  let totalNew = 0;
  let totalProducts = 0;
  projectReports.forEach(p => {
    p.products.forEach(prod => {
      totalNew += (prod.new_items || []).length;
      totalProducts++;
    });
  });

  const hasNew = totalNew > 0;
  const elements = [];

  // === 顶部汇总 ===
  if (hasNew) {
    elements.push({ tag: 'markdown', content: `🆕 **发现新增 ${totalNew} 条** · 覆盖 ${totalProducts} 个产品` });
  } else {
    elements.push({ tag: 'markdown', content: `📭 **无新增任务** · 已检测 ${totalProducts} 个产品` });
  }

  // === 各项目 section ===
  for (const project of projectReports) {
    elements.push({ tag: 'hr' });
    
    // 项目标题（国旗 + 国家）
    const flag = project.flag || '🏴';
    elements.push({ tag: 'markdown', content: `${flag} **${project.country}** · ${project.account_name || project.project_id}` });

    for (const prod of project.products) {
      // 产品名 + 统计
      elements.push({ tag: 'markdown', content: `**${prod.name}** · ${prod.tab_name || ''}` });
      
      // 四列统计
      const cols = [];
      if (prod.stats.done !== undefined) cols.push({ tag: 'column', width: 'weighted', weight: 1, elements: [{ tag: 'markdown', content: `✅ Done\n**${prod.stats.done}**` }] });
      if (prod.stats.link !== undefined) cols.push({ tag: 'column', width: 'weighted', weight: 1, elements: [{ tag: 'markdown', content: `🔗 有Link\n**${prod.stats.link}**` }] });
      if (prod.stats.pending !== undefined) cols.push({ tag: 'column', width: 'weighted', weight: 1, elements: [{ tag: 'markdown', content: `⬜ 待补\n**${prod.stats.pending}**` }] });
      if (prod.stats.cancel !== undefined) cols.push({ tag: 'column', width: 'weighted', weight: 1, elements: [{ tag: 'markdown', content: `❌ 取消\n**${prod.stats.cancel}**` }] });
      
      if (cols.length > 0) {
        elements.push({ tag: 'column_set', columns: cols });
      }

      // 新增明细
      if (prod.new_items && prod.new_items.length > 0) {
        let detail = `🆕 **${prod.name} 新增 ${prod.new_items.length} 条:**\n`;
        prod.new_items.forEach((item, i) => {
          detail += `${i+1}. **${item.content}** · $${item.budget} · ${item.date}\n`;
          if (item.link) detail += `   🔗 ${item.link}\n`;
        });
        elements.push({ tag: 'markdown', content: detail });
      }
    }
  }

  // === 底部 ===
  elements.push({ tag: 'hr' });
  const nextTime = now.getHours() < 10 ? '今日 10:30' :
                   now.getHours() < 15 ? '今日 15:00' :
                   now.getHours() < 18 ? '今日 18:30' : '明日 10:30';
  
  const projectList = projectReports.map(p => `${p.flag || ''} ${p.country}`).join(' · ');
  elements.push({ tag: 'markdown', content: `🕒 下次检测: ${nextTime}\n📋 监测账户: ${projectList}` });

  return {
    schema: '2.0',
    config: { update_multi: true },
    header: {
      title: { tag: 'plain_text', content: `${hasNew ? '🔔' : '📊'} 广告新增检测报告 | ${dateStr} ${timeStr}` },
      template: hasNew ? 'orange' : 'green'
    },
    body: { elements }
  };
}

/**
 * 发送多项目汇总报告
 * @param {Array} projectReports - 多 instance 报告数据
 * @param {string} chatId - 飞书 chat_id;若不传,要求由调用方从 instance.yaml.notification.feishu.chat_id 解析后传入
 */
async function sendMultiProjectReport(projectReports, chatId) {
  if (!chatId) {
    throw new Error('chatId is required. 请从 instance.yaml.notification.feishu.chat_id 读取后传入,不要在脚本中硬编码默认群。');
  }
  const card = buildMultiProjectCard(projectReports);
  const resp = await client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    }
  });
  return resp.data.message_id;
}

// === CLI 模式 ===
if (require.main === module) {
  const arg = process.argv[2];
  const chatIdArg = process.argv[3];
  let reports;
  if (arg) {
    reports = JSON.parse(arg);
  } else {
    // 默认占位测试数据(用于本地烟测,真实数据由 detection 流水线填充)
    reports = [
      {
        project_id: '<instance_id>',
        country: '<Country (CC)>',
        flag: '🏳',
        account_name: '<Account_Name>',
        products: [
          { name: '<Group_A>', tab_name: '<Detection_Tab_A>', stats: { done: 0, link: 0, pending: 0, cancel: 0 }, new_items: [] }
        ]
      }
    ];
  }
  if (!chatIdArg) {
    console.error('Usage: node report_card.cjs <json_array> <chat_id>');
    console.error('chat_id 必须显式传入,从 instance.yaml.notification.feishu.chat_id 读取');
    process.exit(2);
  }
  sendMultiProjectReport(reports, chatIdArg)
    .then(id => console.log('✅ 卡片已发送:', id))
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
}

module.exports = { buildMultiProjectCard, sendMultiProjectReport, discoverProjects };
