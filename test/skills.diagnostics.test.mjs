import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkspaceSkillDiagnostics } from '../src/skills/diagnostics.js'

test('workspace skill diagnostics record paths and filenames but never skill contents', () => {
  const report = buildWorkspaceSkillDiagnostics({
    generatedAt: '2026-11-08T00:00:00.000Z',
    currentWorkspace: 'C:\\work\\bbbbbbb',
    liveAgentCount: 1,
    workspaces: [
      { id: 'w1', title: 'bbbbbbb', path: 'C:\\work\\bbbbbbb', sessionIds: ['s1'] },
    ],
    projectRoots: ['C:\\work\\bbbbbbb'],
    snapshot: {
      sources: [{
        key: 'project-dsh',
        scope: 'C:\\work\\bbbbbbb',
        path: 'C:\\work\\bbbbbbb\\.dsh\\skills',
        exists: true,
        count: 2,
        skills: [
          { name: 'post-exploit-kb', path: 'C:\\work\\bbbbbbb\\.dsh\\skills\\post-exploit-kb\\SKILL.md', content: 'MUST NOT LEAK' },
          { name: 'pyplugin-http', path: 'C:\\work\\bbbbbbb\\.dsh\\skills\\pyplugin-http\\SKILL.md', description: 'MUST NOT LEAK' },
        ],
      }],
      scanError: '',
    },
  })

  assert.equal(report.currentWorkspace, 'C:\\work\\bbbbbbb')
  assert.equal(report.pluginVersion, '0.6.6')
  assert.deepEqual(report.projectRoots, ['C:\\work\\bbbbbbb'])
  assert.equal(report.sources[0].count, 2)
  assert.deepEqual(report.sources[0].skillFiles.map((skill) => skill.name), ['post-exploit-kb', 'pyplugin-http'])
  assert.equal(JSON.stringify(report).includes('MUST NOT LEAK'), false)
})
