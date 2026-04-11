import { safeTool, branchName } from '../src/git'

describe('safeTool', () => {
  it('replaces special characters with hyphens', () => {
    expect(safeTool('github:owner/repo')).toBe('github-owner-repo')
  })

  it('keeps alphanumeric, dot, underscore, hyphen', () => {
    expect(safeTool('node_modules.v1-beta')).toBe('node_modules.v1-beta')
  })

  it('leaves plain tool names unchanged', () => {
    expect(safeTool('actionlint')).toBe('actionlint')
  })
})

describe('branchName', () => {
  it('combines prefix, safe tool name, and version', () => {
    expect(branchName('mise-upgrade', 'actionlint', '1.7.13')).toBe(
      'mise-upgrade/actionlint-1.7.13',
    )
  })

  it('sanitizes tool name in branch', () => {
    expect(branchName('mise-upgrade', 'github:owner/repo', '1.0.0')).toBe(
      'mise-upgrade/github-owner-repo-1.0.0',
    )
  })
})
