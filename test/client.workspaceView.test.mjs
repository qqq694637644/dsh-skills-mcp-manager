/**
 * 工作区视图：选一个工作区后，只显示它（与全局）的技能。
 *
 * 项目级技能按 Git 项目根存储；同一仓库的多个 DSH Workspace 共用一个技能范围。
 * 这里钉住两件事：过滤真的生效，且**全局技能不会被一起藏掉** —— 项目副本可能覆盖同名
 * 全局技能，只留项目那份会让人以为全局的没了。
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

test('默认只看全局：工作区技能不出现在默认视图里', { skip: skipWithoutBundle() }, async () => {
  const panel = await boot()
  try {
    expandAllSources(panel)
    const shown = names(panel)
    assert.deepEqual(shown, ['global-skill'], `默认（全局）应只有全局技能：${JSON.stringify(shown)}`)
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

test('同一 Git 仓库下的多个 DSH 工作区保留真实名称，并明确标出共享的技能根', { skip: skipWithoutBundle() }, async () => {
  const repoRoot = 'C:\\Users\\Administrator\\Desktop\\git_skill\\github_skills_action'
  const governance = {
    ...GOVERNANCE,
    sources: [
      group('global', 'user-dsh', '用户 · DSH', ['global-skill']),
      group(repoRoot, 'project-dsh', '项目 · DSH', ['repo-skill']),
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
    assert.deepEqual(labels, ['全局', 'bbbbbbb (+2)', 'rrrr'])
    assert.equal(labels.includes(repoRoot), false, '技能范围不应把 Git 根目录伪装成 DSH 工作区名称')

    const shared = segments().find((node) => textOf(node).trim() === 'bbbbbbb (+2)')
    assert.ok(shared, '三个同仓库工作区应合并成一个真实技能存储范围')
    assert.match(shared.props.title, /RRR/)
    assert.match(shared.props.title, /attack/)
    assert.match(shared.props.title, /Git 项目根：/)

    panel.click(shared)
    expandAllSources(panel)
    assert.deepEqual(names(panel), ['repo-skill'])
    assert.ok(panel.text().includes('bbbbbbb (+2)'), '技能卡片也应使用工作区名称，而不是 Git 根目录名')
  } finally {
    panel.restore()
  }
})

test('新增技能默认选中当前 DSH 工作区对应的 Git 技能根', { skip: skipWithoutBundle() }, async () => {
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
    const workspace = panel.findAll((node) => node.type === 'select').find((node) => node.props.value === repoRoot)
    assert.ok(workspace, '当前 Workspace Path 应先映射到实际技能 Git 根，不能把原始路径塞进根目录选项')
    const options = workspace.children.flat(Infinity)
      .filter((option) => option !== null && option !== undefined)
      .map((option) => [option.props.value, textOf(option)])
    assert.ok(options.some(([path, label]) => path === repoRoot && label === 'bbbbbbb (+2)'))
  } finally {
    panel.restore()
  }
})

