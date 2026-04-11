import { findOpenPr, findOutdatedPrs, closeOutdatedPrs, createOrGetPr, renderTemplate } from '../src/pr'

function makeOctokit(prs: Array<{ number: number; head: { ref: string }; html_url: string }>) {
  const listFn = jest.fn().mockResolvedValue({ data: prs })
  return {
    paginate: jest.fn().mockResolvedValue(prs),
    rest: {
      pulls: {
        list: listFn,
      },
    },
  }
}

describe('findOpenPr', () => {
  it('returns PR number when open PR exists for the branch', async () => {
    const octokit = makeOctokit([{ number: 42, head: { ref: 'mise-upgrade/actionlint-1.7.13' }, html_url: '' }])
    // findOpenPr uses head filter, so mock returns matching PR
    const result = await findOpenPr(octokit as never, 'owner', 'repo', 'mise-upgrade/actionlint-1.7.13')
    expect(result).toBe(42)
  })

  it('returns null when no open PR exists', async () => {
    const octokit = makeOctokit([])
    const result = await findOpenPr(octokit as never, 'owner', 'repo', 'mise-upgrade/actionlint-1.7.13')
    expect(result).toBeNull()
  })

  it('throws auth error on 401', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    const octokit = { rest: { pulls: { list: jest.fn().mockRejectedValue(err) } } }
    await expect(findOpenPr(octokit as never, 'owner', 'repo', 'branch')).rejects.toThrow(
      'GitHub API authentication failed (401)',
    )
  })
})

describe('findOutdatedPrs', () => {
  const prs = [
    { number: 10, head: { ref: 'mise-upgrade/actionlint-1.7.11' }, html_url: '' },
    { number: 11, head: { ref: 'mise-upgrade/actionlint-1.7.12' }, html_url: '' },
    { number: 12, head: { ref: 'mise-upgrade/actionlint-1.7.13' }, html_url: '' },
    { number: 20, head: { ref: 'mise-upgrade/shellcheck-0.11.0' }, html_url: '' },
  ]

  it('returns PRs matching prefix but not current branch', async () => {
    const octokit = makeOctokit(prs)
    const result = await findOutdatedPrs(
      octokit as never,
      'owner',
      'repo',
      'mise-upgrade/actionlint-',
      'mise-upgrade/actionlint-1.7.13',
    )
    expect(result).toEqual([
      { number: 10, branch: 'mise-upgrade/actionlint-1.7.11' },
      { number: 11, branch: 'mise-upgrade/actionlint-1.7.12' },
    ])
  })

  it('returns empty array when no outdated PRs', async () => {
    const octokit = makeOctokit([
      { number: 12, head: { ref: 'mise-upgrade/actionlint-1.7.13' }, html_url: '' },
    ])
    const result = await findOutdatedPrs(
      octokit as never,
      'owner',
      'repo',
      'mise-upgrade/actionlint-',
      'mise-upgrade/actionlint-1.7.13',
    )
    expect(result).toEqual([])
  })
})

describe('closeOutdatedPrs', () => {
  it('closes each PR and deletes its branch', async () => {
    const update = jest.fn().mockResolvedValue({})
    const deleteRef = jest.fn().mockResolvedValue({})
    const octokit = {
      rest: {
        pulls: { update },
        git: { deleteRef },
      },
    }
    const prs = [
      { number: 10, branch: 'mise-upgrade/actionlint-1.7.11' },
      { number: 11, branch: 'mise-upgrade/actionlint-1.7.12' },
    ]
    await closeOutdatedPrs(octokit as never, 'owner', 'repo', prs)
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', pull_number: 10, state: 'closed' })
    expect(update).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', pull_number: 11, state: 'closed' })
    expect(deleteRef).toHaveBeenCalledTimes(2)
    expect(deleteRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'heads/mise-upgrade/actionlint-1.7.11' })
    expect(deleteRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'heads/mise-upgrade/actionlint-1.7.12' })
  })
})

describe('renderTemplate', () => {
  it('replaces {tool} and {version} placeholders', () => {
    expect(renderTemplate('deps: Upgrade {tool} to {version}', 'actionlint', '1.7.13')).toBe(
      'deps: Upgrade actionlint to 1.7.13',
    )
  })

  it('replaces multiple occurrences', () => {
    expect(renderTemplate('{tool} {tool} {version}', 'node', '22.0.0')).toBe('node node 22.0.0')
  })

  it('leaves template unchanged when no placeholders match', () => {
    expect(renderTemplate('no placeholders here', 'tool', '1.0')).toBe('no placeholders here')
  })
})

describe('createOrGetPr', () => {
  const baseOpts = {
    owner: 'owner',
    repo: 'repo',
    tool: 'actionlint',
    version: '1.7.13',
    branch: 'mise-upgrade/actionlint-1.7.13',
    baseBranch: 'main',
    labels: [],
    assignees: [],
    prTitle: 'deps: Upgrade {tool} to {version}',
    prBody: 'Automated upgrade of {tool} to {version}.',
  }

  it('creates a new PR and returns its URL', async () => {
    const create = jest.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/owner/repo/pull/42' } })
    const octokit = { rest: { pulls: { create }, issues: {} } }
    const url = await createOrGetPr({ ...baseOpts, octokit: octokit as never })
    expect(create).toHaveBeenCalledTimes(1)
    expect(url).toBe('https://github.com/owner/repo/pull/42')
  })

  it('renders title and body templates before creating PR', async () => {
    const create = jest.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/owner/repo/pull/42' } })
    const octokit = { rest: { pulls: { create }, issues: {} } }
    await createOrGetPr({
      ...baseOpts,
      octokit: octokit as never,
      prTitle: 'chore: bump {tool} to {version}',
      prBody: 'Upgrades {tool} → {version}.',
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'chore: bump actionlint to 1.7.13',
      body: 'Upgrades actionlint → 1.7.13.',
    }))
  })

  it('falls back to existing PR on 422 error', async () => {
    const err = Object.assign(new Error('already exists'), { status: 422 })
    const create = jest.fn().mockRejectedValue(err)
    const list = jest.fn().mockResolvedValue({ data: [{ number: 99, html_url: 'https://github.com/owner/repo/pull/99' }] })
    const octokit = { rest: { pulls: { create, list }, issues: {} } }
    const url = await createOrGetPr({ ...baseOpts, octokit: octokit as never })
    expect(url).toBe('https://github.com/owner/repo/pull/99')
  })

  it('throws auth error message on 401', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    const create = jest.fn().mockRejectedValue(err)
    const octokit = { rest: { pulls: { create }, issues: {} } }
    await expect(createOrGetPr({ ...baseOpts, octokit: octokit as never })).rejects.toThrow(
      'GitHub API authentication failed (401)',
    )
  })

  it('throws rate limit error message on 403', async () => {
    const err = Object.assign(new Error('forbidden'), { status: 403 })
    const create = jest.fn().mockRejectedValue(err)
    const octokit = { rest: { pulls: { create }, issues: {} } }
    await expect(createOrGetPr({ ...baseOpts, octokit: octokit as never })).rejects.toThrow(
      'GitHub API rate limit or permission error (403)',
    )
  })

  it('throws rate limit error message on 429', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 })
    const create = jest.fn().mockRejectedValue(err)
    const octokit = { rest: { pulls: { create }, issues: {} } }
    await expect(createOrGetPr({ ...baseOpts, octokit: octokit as never })).rejects.toThrow(
      'GitHub API rate limit or permission error (429)',
    )
  })

  it('throws contextual error message on other HTTP errors', async () => {
    const err = Object.assign(new Error('server error'), { status: 500 })
    const create = jest.fn().mockRejectedValue(err)
    const octokit = { rest: { pulls: { create }, issues: {} } }
    await expect(createOrGetPr({ ...baseOpts, octokit: octokit as never })).rejects.toThrow(
      'GitHub API error 500 during createPr: server error',
    )
  })

  it('applies labels and assignees after creating PR', async () => {
    const create = jest.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/owner/repo/pull/42' } })
    const addLabels = jest.fn().mockResolvedValue({})
    const addAssignees = jest.fn().mockResolvedValue({})
    const octokit = { rest: { pulls: { create }, issues: { addLabels, addAssignees } } }
    await createOrGetPr({ ...baseOpts, octokit: octokit as never, labels: ['bug'], assignees: ['alice'] })
    expect(addLabels).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', issue_number: 42, labels: ['bug'] })
    expect(addAssignees).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', issue_number: 42, assignees: ['alice'] })
  })
})
