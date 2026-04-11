import { findOpenPr, findOutdatedPrs, closeOutdatedPrs, createOrGetPr } from '../src/pr'

function makeOctokit(prs: Array<{ number: number; head: { ref: string }; html_url: string }>) {
  return {
    rest: {
      pulls: {
        list: jest.fn().mockResolvedValue({ data: prs }),
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
  }

  it('creates a new PR and returns its URL', async () => {
    const create = jest.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/owner/repo/pull/42' } })
    const octokit = { rest: { pulls: { create }, issues: {} } }
    const url = await createOrGetPr({ ...baseOpts, octokit: octokit as never })
    expect(create).toHaveBeenCalledTimes(1)
    expect(url).toBe('https://github.com/owner/repo/pull/42')
  })

  it('falls back to existing PR on 422 error', async () => {
    const err = Object.assign(new Error('already exists'), { status: 422 })
    const create = jest.fn().mockRejectedValue(err)
    const list = jest.fn().mockResolvedValue({ data: [{ number: 99, html_url: 'https://github.com/owner/repo/pull/99' }] })
    const octokit = { rest: { pulls: { create, list }, issues: {} } }
    const url = await createOrGetPr({ ...baseOpts, octokit: octokit as never })
    expect(url).toBe('https://github.com/owner/repo/pull/99')
  })

  it('rethrows non-422 errors', async () => {
    const err = Object.assign(new Error('server error'), { status: 500 })
    const create = jest.fn().mockRejectedValue(err)
    const octokit = { rest: { pulls: { create }, issues: {} } }
    await expect(createOrGetPr({ ...baseOpts, octokit: octokit as never })).rejects.toThrow('server error')
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
