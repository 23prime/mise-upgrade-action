import * as exec from '@actions/exec'

export function safeTool(tool: string): string {
  return tool.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export function branchName(prefix: string, tool: string, version: string): string {
  return `${prefix}/${safeTool(tool)}-${version}`
}

export async function configureGit(token: string, repository: string): Promise<void> {
  await exec.exec('git', ['config', 'user.name', 'github-actions[bot]'])
  await exec.exec('git', [
    'config',
    'user.email',
    '41898282+github-actions[bot]@users.noreply.github.com',
  ])
  await exec.exec(
    'git',
    ['remote', 'set-url', 'origin', `https://x-access-token:${token}@github.com/${repository}.git`],
    { silent: true },
  )
}

export async function checkoutBranch(branch: string): Promise<void> {
  await exec.exec('git', ['checkout', '-B', branch])
}

export async function commitAndPush(tool: string, version: string, branch: string): Promise<boolean> {
  await exec.exec('git', ['add', 'mise.toml', 'mise.lock'])
  const diffExitCode = await exec.exec('git', ['diff', '--staged', '--quiet'], {
    ignoreReturnCode: true,
  })
  if (diffExitCode === 0) {
    return false
  }
  await exec.exec('git', ['commit', '-m', `deps: Upgrade ${tool} to ${version}`])
  await exec.exec(
    'git',
    ['fetch', 'origin', `refs/heads/${branch}:refs/remotes/origin/${branch}`],
    { ignoreReturnCode: true },
  )
  await exec.exec('git', ['push', '--force-with-lease', 'origin', branch])
  return true
}
