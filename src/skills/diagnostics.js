/**
 * Safe, content-free diagnostics for project skill discovery.
 *
 * This report deliberately records paths, source counts and skill filenames only.
 * It never reads or serializes SKILL.md contents, descriptions or frontmatter.
 */
export function buildWorkspaceSkillDiagnostics({
  snapshot = {},
  workspaces = [],
  projectRoots = [],
  currentWorkspace = '',
  liveAgentCount = 0,
  generatedAt = new Date().toISOString(),
} = {}) {
  const sources = Array.isArray(snapshot.sources) ? snapshot.sources : []
  return {
    schemaVersion: 1,
    pluginVersion: '0.6.6',
    generatedAt,
    currentWorkspace: String(currentWorkspace ?? ''),
    liveAgentCount: Number.isFinite(Number(liveAgentCount)) ? Number(liveAgentCount) : 0,
    workspaces: (Array.isArray(workspaces) ? workspaces : []).map((workspace) => ({
      id: String(workspace?.id ?? ''),
      title: String(workspace?.title ?? ''),
      path: String(workspace?.path ?? ''),
      sessionCount: Array.isArray(workspace?.sessionIds) ? workspace.sessionIds.length : null,
    })),
    projectRoots: (Array.isArray(projectRoots) ? projectRoots : []).map((path) => String(path ?? '')),
    sources: sources.map((source) => ({
      key: String(source?.key ?? ''),
      scope: String(source?.scope ?? ''),
      path: String(source?.path ?? ''),
      exists: source?.exists === true,
      count: Number.isFinite(Number(source?.count)) ? Number(source.count) : 0,
      skillFiles: (Array.isArray(source?.skills) ? source.skills : []).map((skill) => ({
        name: String(skill?.name ?? ''),
        path: String(skill?.path ?? ''),
      })),
    })),
    scanError: String(snapshot.scanError ?? ''),
  }
}
