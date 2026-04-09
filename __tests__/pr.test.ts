import { findOpenPr, findOutdatedPrs } from '../src/pr'

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
    const octokit = makeOctokit(prs)
    const result = await findOutdatedPrs(
      octokit as never,
      'owner',
      'repo',
      'mise-upgrade/actionlint-',
      'mise-upgrade/actionlint-1.7.11', // oldest is current
    )
    expect(result.map((p) => p.number)).not.toContain(10)
  })
})
