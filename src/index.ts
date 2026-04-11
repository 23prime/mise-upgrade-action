import * as core from '@actions/core'
import * as github from '@actions/github'
import { findLatestVersion } from './outdated'
import { validateToolExists, upgradeTool, currentVersion } from './upgrade'
import { branchName, configureGit, checkoutBranch, commitAndPush, safeTool } from './git'
import { findOpenPr, findOutdatedPrs, closeOutdatedPrs, createOrGetPr } from './pr'

export async function run(): Promise<void> {
  const token = core.getInput('token', { required: true })
  const tool = core.getInput('tool', { required: true })
  const branchPrefix = core.getInput('branch-prefix') || 'mise-upgrade'
  const bump = core.getInput('bump') !== 'false'
  const labels = core
    .getInput('labels')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const assignees = core
    .getInput('assignees')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const prTitle = core.getInput('pr-title')
  const prBody = core.getInput('pr-body')
  const installBefore = core.getInput('install-before').trim()
  if (installBefore) {
    process.env['MISE_INSTALL_BEFORE'] = installBefore
  }

  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo
  const repository = `${owner}/${repo}`

  // 1. Validate tool exists in mise.toml
  await validateToolExists(tool)

  // 2. Check for update
  const latestVersion = await findLatestVersion(tool)
  if (!latestVersion) {
    core.info(`${tool} is already up to date.`)
    core.setOutput('changed', 'false')
    return
  }
  core.info(`${tool} -> ${latestVersion}`)
  core.setOutput('changed', 'true')

  // 3. Upgrade
  await upgradeTool(tool, bump)
  const newVersion = await currentVersion(tool)
  if (!newVersion) {
    throw new Error(`Unable to determine current version for "${tool}" after upgrade`)
  }

  // 4. Determine branch
  const branch = branchName(branchPrefix, tool, newVersion)
  const toolPrefix = `${branchPrefix}/${safeTool(tool)}-`

  // 5. Skip if open PR already exists for this exact version
  await configureGit(token, repository)
  const existingPrNumber = await findOpenPr(octokit, owner, repo, branch)
  if (existingPrNumber !== null) {
    const existingPrUrl = `https://github.com/${owner}/${repo}/pull/${existingPrNumber}`
    core.setOutput('pr-url', existingPrUrl)
    core.info(`Open PR already exists for ${tool} ${newVersion}: ${existingPrUrl}`)
    return
  }

  // 6. Close outdated PRs for the same tool
  const outdatedPrs = await findOutdatedPrs(octokit, owner, repo, toolPrefix, branch)
  if (outdatedPrs.length > 0) {
    core.info(`Closing ${outdatedPrs.length} outdated PR(s) for ${tool}`)
    await closeOutdatedPrs(octokit, owner, repo, outdatedPrs)
  }

  // 7. Commit and push
  await checkoutBranch(branch)
  await commitAndPush(tool, newVersion, branch)

  // 8. Get default branch
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo })
  const baseBranch = repoData.default_branch

  // 9. Create or get PR
  const prUrl = await createOrGetPr({
    octokit,
    owner,
    repo,
    tool,
    version: newVersion,
    branch,
    baseBranch,
    labels,
    assignees,
    prTitle,
    prBody,
  })

  core.setOutput('pr-url', prUrl)
  core.info(`Pull request: ${prUrl}`)
}
