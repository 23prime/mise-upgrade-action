import * as github from '@actions/github'

type Octokit = ReturnType<typeof github.getOctokit>

function httpStatus(err: unknown): number | undefined {
  if (err instanceof Error && 'status' in err && typeof (err as { status?: unknown }).status === 'number') {
    return (err as { status: number }).status
  }
  return undefined
}

function rethrowWithContext(err: unknown, context: string): never {
  const status = httpStatus(err)
  const originalMessage = err instanceof Error ? err.message : String(err)
  if (status === 401) {
    throw new Error(
      `GitHub API authentication failed (401). Check that the token has the required permissions (contents: write, pull-requests: write). Original error: ${originalMessage}`,
      { cause: err },
    )
  }
  if (status === 403 || status === 429) {
    throw new Error(
      `GitHub API rate limit or permission error (${status}). Try again later or check token scopes. Original error: ${originalMessage}`,
      { cause: err },
    )
  }
  if (status !== undefined) {
    throw new Error(`GitHub API error ${status} during ${context}: ${originalMessage}`, { cause: err })
  }
  throw err
}

export interface PrOptions {
  octokit: Octokit
  owner: string
  repo: string
  tool: string
  version: string
  branch: string
  baseBranch: string
  labels: string[]
  assignees: string[]
  prTitle: string
  prBody: string
}

export function renderTemplate(template: string, tool: string, version: string): string {
  return template.replace(/\{tool\}/g, () => tool).replace(/\{version\}/g, () => version)
}

export async function findOpenPr(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<number | null> {
  try {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'open',
    })
    return data[0]?.number ?? null
  } catch (err: unknown) {
    rethrowWithContext(err, 'findOpenPr')
  }
}

export async function findOutdatedPrs(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchPrefix: string,
  currentBranch: string,
): Promise<Array<{ number: number; branch: string }>> {
  const data = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  })
  return data
    .filter((pr) => pr.head.ref.startsWith(branchPrefix) && pr.head.ref !== currentBranch)
    .map((pr) => ({ number: pr.number, branch: pr.head.ref }))
}

export async function closeOutdatedPrs(
  octokit: Octokit,
  owner: string,
  repo: string,
  prs: Array<{ number: number; branch: string }>,
): Promise<void> {
  for (const pr of prs) {
    await octokit.rest.pulls.update({ owner, repo, pull_number: pr.number, state: 'closed' })
    await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${pr.branch}` })
  }
}

export async function createOrGetPr(opts: PrOptions): Promise<string> {
  const { octokit, owner, repo, tool, version, branch, baseBranch, labels, assignees, prTitle, prBody } = opts

  let prNumber: number
  let prUrl: string

  try {
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: renderTemplate(prTitle, tool, version),
      body: renderTemplate(prBody, tool, version),
      base: baseBranch,
      head: branch,
    })
    prNumber = data.number
    prUrl = data.html_url
  } catch (err: unknown) {
    if (httpStatus(err) !== 422) rethrowWithContext(err, 'createPr')
    const existing = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'open',
    })
    const pr = existing.data[0]
    if (!pr) throw new Error(`Failed to create PR and no existing PR found for branch ${branch}`)
    prNumber = pr.number
    prUrl = pr.html_url
  }

  if (labels.length > 0) {
    await octokit.rest.issues.addLabels({ owner, repo, issue_number: prNumber, labels })
  }
  if (assignees.length > 0) {
    await octokit.rest.issues.addAssignees({ owner, repo, issue_number: prNumber, assignees })
  }

  return prUrl
}
