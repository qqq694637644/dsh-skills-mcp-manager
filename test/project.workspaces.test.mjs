import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentWorkspacePath } from '../src/project/workspaces.js'

const B = 'C:\\Users\\me\\repo\\data\\workspaces\\bbbbbbb'
const R = 'D:\\repos\\rrrr'

test('current workspace follows the active SessionId ledger, not agent insertion order or Git root', () => {
  const workspaces = [
    { id: 'w-b', path: B, sessionIds: ['session-b'] },
    { id: 'w-r', path: R, sessionIds: ['session-r'] },
  ]
  const agents = [
    { id: 'session-r', session: { header: { cwd: R } } },
    { id: 'session-b', session: { header: { cwd: B } } },
  ]

  assert.equal(currentWorkspacePath(workspaces, [agents[1]]), B)
  assert.equal(currentWorkspacePath(workspaces, [agents[0]]), R)
  assert.equal(currentWorkspacePath(workspaces, agents), '', 'multiple live workspace memberships are ambiguous')
})

test('multiple live sessions in one workspace still resolve to that workspace', () => {
  const workspaces = [{ path: B, sessionIds: ['session-b1', 'session-b2'] }]
  const agents = [{ id: 'session-b1' }, { id: 'session-b2' }]
  assert.equal(currentWorkspacePath(workspaces, agents), B)
})

test('an available sessionIds ledger is authoritative; a cwd coincidence cannot invent membership', () => {
  const workspaces = [{ path: B, sessionIds: [] }]
  const agents = [{ id: 'session-other', session: { header: { cwd: B } } }]
  assert.equal(currentWorkspacePath(workspaces, agents), '')
})

test('legacy workspace projections fall back to exact immutable header cwd, case-insensitively on Windows', () => {
  const workspaces = [{ path: B }]
  const agents = [{ id: 'session-b', session: { header: { cwd: B.toLowerCase().replace(/\\/g, '/') } } }]
  assert.equal(currentWorkspacePath(workspaces, agents), B)
})

test('no unique active workspace means no default, rather than selecting the first registered workspace', () => {
  const workspaces = [{ path: B, sessionIds: [] }, { path: R, sessionIds: [] }]
  assert.equal(currentWorkspacePath(workspaces, [{ id: 'unmatched-session' }]), '')
  assert.equal(currentWorkspacePath(workspaces, []), '')
})
