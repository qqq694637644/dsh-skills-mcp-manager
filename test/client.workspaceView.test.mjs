/**
 * 工作区视图：默认跟随当前 DSH Workspace；显式切换后只显示选定范围。
 *
 * 项目级技能按 DSH Workspace path 存储；同一 Git 仓库中的 Workspace 仍然彼此独立。
 * 全局与项目范围保持独立；没有唯一当前 Workspace 时默认全局，不能按注册顺序猜项目。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootPanel, emptyDoc, skipWithoutBundle, textOf } from '../scripts/lib/client-harness.mjs'

const skill = (name, scope, source) => ({
  name,
  description: '',
  path: `${scope === 'global' ? '/h' : scope}/${source.endsWith('agents') ? '.agents' : '.dsh'}/skills/${name}/SKILL.md`,
  source,
  scope,
  rank: 400,
  readonly: false,
  enabled: true,
})

const group = (scope, source, label, names) => ({
  key: source,
  label,
  path: `${scope === 'global' ? '/h' : scope}/${source.endsWith('agents') ? '.agents' : '.dsh'}/skills`,
  scope,
  rank: 400,
  native: true,
  readonly: false,
  exists: true,
  enabled: true,
  count: names.length,
  skills: names.map((name) => skill(name, scope, source)),
})

const GOVERNANCE = {
  sources: [
    group('global', 'user-dsh', '用户 · DSH', ['global-skill']),
    group('/p/one', 'project-dsh', '项目 · DSH', ['one-skill']),
    group('/p/two', 'project-dsh', '项目 · DSH', ['two-skill']),
  ],
  categories: [],
  trash: [],
  repositories: [],
  installs: [],
  providerInstalled: true,
}

const makeFetch = (doc) => async () => ({
  ok: true, status: 200,
  json: async () => ({
    serverTools: [], serverStatus: [], serverToolsError: { reason: '', detail: '' },
    servers: [], skills: [], skillDirs: {}, workspaces: doc.workspaces ?? [], currentWorkspace: doc.runtimeCurrentWorkspace ?? '',
    filter: {}, probe: {}, oauth: { servers: {} }, discovery: {}, skillGovernance: doc.skillGovernance,
  }),
})

const boot = async ({
  skillGovernance = GOVERNANCE,
  workspaces = [{ path: '/p/one', title: 'one' }, { path: '/p/two', title: 'two' }],
  currentWorkspace = '',
} = {}) => {
  const doc = emptyDoc({
    skillGovernance,
    workspaces,
    runtimeCurrentWorkspace: currentWorkspace,
  })
  const panel = await bootPanel(doc, { fetch: makeFetch(doc) })
  const tab = panel.find((node) => String(node.props?.className ?? '').includes('smp-tab') && textOf(node).startsWith('Skills'))
  assert.ok(tab !== null, '找不到 Skills 页签')
  panel.click(tab)
  return panel
}

/** 来源默认收起（避免页面被拉长），断言技能名之前先全部展开。 */
const expandAllSources = (panel) => {
  for (let guard = 0; guard < 20; guard += 1) {
    const collapsed = panel.findAll((node) => (
      String(node.props?.className ?? '').split(/\s+/).includes('smp-skillSourceToggle')
      && node.props['aria-expanded'] === false
    ))
    if (collapsed.length === 0) break
    panel.click(collapsed[0])
  }
}

const names = (panel) => panel
  .findAll((node) => String(node.props?.className ?? '').split(/\s+/).includes('smp-skillName'))
  .map((node) => textOf(node).trim())

test('没有唯一当前 Workspace 时默认只看全局', { skip: skipWithoutBundle() }, async () => {
  const panel = await boot()
  try {
    expandAllSources(panel)
    const shown = names(panel)
    assert.deepEqual(shown, ['global-skill'], `默认（全局）应只有全局技能：${JSON.stringify(shown)}`)
  } finally {
    panel.restore()
  }
})

test('默认范围跟随当前 DSH Workspace 的原始路径，不映射到 Git 根', { skip: skipWithoutBundle() }, async () => {
  const repoRoot = 'C:\\Users\\Administrator\\Desktop\\git_skill\\github_skills_action'
  const projectRoot = 'D:\\repos\\rrrr'
  const currentWorkspace = projectRoot + '\\uuycold\\RRR'
  const workspaces = [
    { path: repoRoot + '\\data\\workspaces\\bbbbbbb', root: repoRoot, title: 'bbbbbbb' },
    { path: projectRoot, root: projectRoot, title: 'rrrr' },
    { path: currentWorkspace, root: projectRoot, title: 'RRR' },
    { path: repoRoot + '\\data\\workspaces\\attack', root: repoRoot, title: 'attack' },
  ]
  const governance = {
    ...GOVERNANCE,
    sources: [
      group('global', 'user-dsh', '用户 · DSH', ['global-skill']),
      group(workspaces[0].path, 'project-dsh', '项目 · DSH', ['bbbbbbb-skill']),
      group(projectRoot, 'project-dsh', '项目 · DSH', ['rrrr-skill']),
      group(currentWorkspace, 'project-dsh', '项目 · DSH', ['RRR-skill']),
    ],
  }
  const panel = await boot({ skillGovernance: governance, workspaces, currentWorkspace })
  try {
    const segments = () => panel.findAll((node) => String(node.props?.className ?? '') === 'smp-segment')
    const active = segments().filter((node) => node.props['data-active'] === 'true')
    assert.deepEqual(active.map((node) => textOf(node).trim()), ['RRR'])

    expandAllSources(panel)
    assert.deepEqual(names(panel), ['RRR-skill'], '嵌套 Workspace 只显示自己的项目技能')
    const ledger = textOf(panel.find((node) => String(node.props?.className ?? '').split(/\s+/).includes('smp-ledger')))
    assert.match(ledger, /1\s*\/\s*1/)
    assert.match(ledger, /RRR/)
  } finally {
    panel.restore()
  }
})

test('自动范围随运行时当前 Workspace 更新，手动选择则保持固定', { skip: skipWithoutBundle() }, async () => {
  const projectRoot = 'D:\\repos\\rrrr'
  const otherRoot = 'C:\\work'
  const currentWorkspace = projectRoot + '\\uuycold\\RRR'
  const otherWorkspace = otherRoot + '\\attack'
  const workspaces = [
    { path: currentWorkspace, root: projectRoot, title: 'RRR' },
    { path: otherWorkspace, root: otherRoot, title: 'attack' },
  ]
  const governance = {
    ...GOVERNANCE,
    sources: [
      group(currentWorkspace, 'project-dsh', '项目 · DSH', ['RRR-skill']),
      group(otherWorkspace, 'project-dsh', '项目 · DSH', ['attack-skill']),
    ],
  }
  const panel = await boot({ skillGovernance: governance, workspaces, currentWorkspace })
  try {
    const segments = () => panel.findAll((node) => String(node.props?.className ?? '') === 'smp-segment')
    const activeLabel = () => segments().find((node) => node.props['data-active'] === 'true')?.children
      .map((child) => typeof child === 'string' ? child : textOf(child)).join('').trim()
    assert.equal(activeLabel(), 'RRR')

    const channel = panel.channels.find((item) => item.name === 'dsh-skills-mcp-manager/oauth')
    assert.ok(channel, '运行时刷新广播频道应已注册')
    panel.doc.runtimeCurrentWorkspace = otherWorkspace
    channel.emit('authorized')
    await panel.settle()
    await panel.settle()
    assert.equal(activeLabel(), 'attack', '自动模式应跟随最新的 currentWorkspace')

    const pinned = segments().find((node) => textOf(node).trim() === 'RRR')
    assert.ok(pinned)
    panel.click(pinned)
    panel.doc.runtimeCurrentWorkspace = otherWorkspace
    channel.emit('authorized')
    await panel.settle()
    await panel.settle()
    assert.equal(activeLabel(), 'RRR', '用户显式选择后不应被运行时刷新覆盖')
  } finally {
    panel.restore()
  }
})

test('清除筛选恢复当前 Workspace，而不是全局或注册表中的第一个项目', { skip: skipWithoutBundle() }, async () => {
  const projectRoot = 'D:\\repos\\rrrr'
  const currentWorkspace = projectRoot + '\\uuycold\\RRR'
  const governance = {
    ...GOVERNANCE,
    sources: [
      group('global', 'user-dsh', '用户 · DSH', ['global-skill']),
      group(projectRoot, 'project-dsh', '项目 · DSH', ['rrrr-skill']),
      group(currentWorkspace, 'project-dsh', '项目 · DSH', ['RRR-skill']),
    ],
  }
  const workspaces = [
    { path: 'C:\\work\\bbbbbbb', root: 'C:\\work', title: 'bbbbbbb' },
    { path: projectRoot, root: projectRoot, title: 'rrrr' },
    { path: currentWorkspace, root: projectRoot, title: 'RRR' },
  ]
  const panel = await boot({ skillGovernance: governance, workspaces, currentWorkspace })
  try {
    const global = panel.findAll((node) => String(node.props?.className ?? '') === 'smp-segment')
      .find((node) => textOf(node).trim() === '全局')
    assert.ok(global)
    panel.click(global)
    panel.change(panel.byPlaceholder('搜索技能名称'), 'definitely-not-a-skill')

    const reset = panel.findAll((node) => node.type === 'button' && textOf(node).trim() === '清除筛选')
    assert.equal(reset.length, 1)
    panel.click(reset[0])

    const active = panel.findAll((node) => String(node.props?.className ?? '') === 'smp-segment')
      .filter((node) => node.props['data-active'] === 'true')
    assert.deepEqual(active.map((node) => textOf(node).trim()), ['RRR'])
    expandAllSources(panel)
    assert.deepEqual(names(panel), ['RRR-skill'])
  } finally {
    panel.restore()
  }
})

test('没有唯一当前 Workspace 时，清除筛选回到全局，不猜测第一个项目', { skip: skipWithoutBundle() }, async () => {
  const governance = {
    ...GOVERNANCE,
    sources: [
      group('/p/one', 'project-dsh', '项目 · DSH', ['one-skill']),
      group('/p/two', 'project-dsh', '项目 · DSH', ['two-skill']),
    ],
  }
  const panel = await boot({
    skillGovernance: governance,
    workspaces: [{ path: '/p/one', title: 'one' }, { path: '/p/two', title: 'two' }],
  })
  try {
    panel.change(panel.byPlaceholder('搜索技能名称'), 'definitely-not-a-skill')
    const reset = panel.findAll((node) => node.type === 'button' && textOf(node).trim() === '清除筛选')
    assert.equal(reset.length, 1)
    panel.click(reset[0])

    const active = panel.findAll((node) => String(node.props?.className ?? '') === 'smp-segment')
      .filter((node) => node.props['data-active'] === 'true')
    assert.deepEqual(active.map((node) => textOf(node).trim()), ['全局'])
    expandAllSources(panel)
    assert.deepEqual(names(panel), [])
  } finally {
    panel.restore()
  }
})

test('来源默认收起：只看到来源标题，展开后才出现技能', { skip: skipWithoutBundle() }, async () => {
  const panel = await boot()
  try {
    assert.deepEqual(names(panel), [], '默认收起时不该有技能卡片')
    const toggles = panel.findAll((node) => String(node.props?.className ?? '').split(/\s+/).includes('smp-skillSourceToggle'))
    assert.equal(toggles.length, 1, `默认（全局）应只渲染全局来源，实际 ${toggles.length}`)
    assert.ok(panel.text().includes('用户 · DSH'), '收起时仍要显示来源名')

    panel.click(toggles[0])
    const shown = names(panel)
    assert.equal(shown.length, 1, `展开一个来源应只出现它的技能：${JSON.stringify(shown)}`)
  } finally {
    panel.restore()
  }
})

test('按范围过滤：全局与某个工作区互斥，切换即换视图', { skip: skipWithoutBundle() }, async () => {
  /**
   * 范围从原生 `<select>` 换成了分段控件：互斥的选项摊在页面上。
   * 这里钉的是**互斥性与切换结果**，与控件形态无关。
   */
  const panel = await boot()
  try {
    const segments = () => panel.findAll((node) => (
      String(node.props?.className ?? '').split(/\s+/).includes('smp-segment')
    ))
    const labels = segments().map((node) => textOf(node).trim())
    assert.ok(labels.includes('全局'), `范围里应有「全局」：${JSON.stringify(labels)}`)
    assert.equal(labels.includes('全部'), false, `不该有「全部」这一档：${JSON.stringify(labels)}`)

    const pick = (label) => {
      const target = segments().find((node) => textOf(node).trim() === label)
      assert.ok(target !== undefined, `找不到范围「${label}」：${JSON.stringify(labels)}`)
      panel.click(target)
    }

    pick('one')
    expandAllSources(panel)
    assert.deepEqual(names(panel), ['one-skill'], '只看工作区时应只有它的技能')

    pick('two')
    expandAllSources(panel)
    assert.deepEqual(names(panel), ['two-skill'], '换一个工作区应换成它的技能')

    pick('全局')
    expandAllSources(panel)
    assert.deepEqual(names(panel), ['global-skill'], '切回全局应只剩全局技能')
  } finally {
    panel.restore()
  }
})

test('同一 Git 仓库下的多个 DSH Workspace 保持独立技能范围', { skip: skipWithoutBundle() }, async () => {
  const repoRoot = 'C:\\Users\\Administrator\\Desktop\\git_skill\\github_skills_action'
  const governance = {
    ...GOVERNANCE,
    sources: [
      group('global', 'user-dsh', '用户 · DSH', ['global-skill']),
      group(repoRoot + '\\data\\workspaces\\bbbbbbb', 'project-dsh', '项目 · DSH', ['bbbbbbb-skill']),
      group(repoRoot + '\\data\\workspaces\\RRR', 'project-dsh', '项目 · DSH', ['RRR-skill']),
      group(repoRoot + '\\data\\workspaces\\attack', 'project-dsh', '项目 · DSH', ['attack-skill']),
      group('D:\\repos\\rrrr', 'project-dsh', '项目 · DSH', ['rrrr-skill']),
    ],
  }
  const workspaces = [
    { path: `${repoRoot}\\data\\workspaces\\bbbbbbb`, root: repoRoot, title: 'bbbbbbb' },
    { path: `${repoRoot}\\data\\workspaces\\RRR`, root: repoRoot, title: 'RRR' },
    { path: `${repoRoot}\\data\\workspaces\\attack`, root: repoRoot, title: 'attack' },
    { path: 'D:\\repos\\rrrr', root: 'D:\\repos\\rrrr', title: 'rrrr' },
  ]
  const panel = await boot({ skillGovernance: governance, workspaces })
  try {
    const segments = () => panel.findAll((node) => String(node.props?.className ?? '') === 'smp-segment')
    const labels = segments().map((node) => textOf(node).trim())
    for (const label of ['全局', 'bbbbbbb', 'RRR', 'attack', 'rrrr']) {
      assert.ok(labels.includes(label), '缺少独立 Workspace 范围 ' + label + '：' + JSON.stringify(labels))
    }
    assert.equal(labels.some((label) => label.includes('(+')), false, '不同 Workspace 不应合并成 +N')

    const nested = segments().find((node) => textOf(node).trim() === 'RRR')
    assert.ok(nested)
    panel.click(nested)
    expandAllSources(panel)
    assert.deepEqual(names(panel), ['RRR-skill'])
  } finally {
    panel.restore()
  }
})

test('新增技能默认选中当前 DSH Workspace 的原始路径', { skip: skipWithoutBundle() }, async () => {
  const repoRoot = 'C:\\Users\\Administrator\\Desktop\\git_skill\\github_skills_action'
  const currentWorkspace = `${repoRoot}\\data\\workspaces\\bbbbbbb`
  const workspaces = [
    { path: currentWorkspace, root: repoRoot, title: 'bbbbbbb' },
    { path: `${repoRoot}\\data\\workspaces\\RRR`, root: repoRoot, title: 'RRR' },
    { path: `${repoRoot}\\data\\workspaces\\attack`, root: repoRoot, title: 'attack' },
  ]
  const panel = await boot({ workspaces, currentWorkspace })
  try {
    panel.click(panel.byText('添加技能'))
    const scope = panel.findAll((node) => node.type === 'select').find((node) => node.props.value === 'global')
    assert.ok(scope, '添加技能对话框应有层级选择')
    panel.change(scope, 'project')
    const workspace = panel.findAll((node) => node.type === 'select').find((node) => node.props.value === currentWorkspace)
    assert.ok(workspace, '项目技能目标应锁定到当前 Workspace path')
    const options = workspace.children.flat(Infinity)
      .filter((option) => option !== null && option !== undefined)
      .map((option) => [option.props.value, textOf(option)])
    assert.ok(options.some(([path, label]) => path === currentWorkspace && label === 'bbbbbbb'))
  } finally {
    panel.restore()
  }
})

