import * as core from '@actions/core'
import * as github from '@actions/github'
import * as outdated from '../src/outdated'
import * as upgrade from '../src/upgrade'
import * as git from '../src/git'
import * as pr from '../src/pr'
import { run } from '../src/index'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../src/outdated')
jest.mock('../src/upgrade')
jest.mock('../src/git')
jest.mock('../src/pr')

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>
const mockSetOutput = core.setOutput as jest.MockedFunction<typeof core.setOutput>
const mockGetOctokit = github.getOctokit as jest.MockedFunction<typeof github.getOctokit>

const mockFindLatestVersion = outdated.findLatestVersion as jest.MockedFunction<typeof outdated.findLatestVersion>
const mockValidateToolExists = upgrade.validateToolExists as jest.MockedFunction<typeof upgrade.validateToolExists>
const mockUpgradeTool = upgrade.upgradeTool as jest.MockedFunction<typeof upgrade.upgradeTool>
const mockCurrentVersion = upgrade.currentVersion as jest.MockedFunction<typeof upgrade.currentVersion>
const mockBranchName = git.branchName as jest.MockedFunction<typeof git.branchName>
const mockSafeTool = git.safeTool as jest.MockedFunction<typeof git.safeTool>
const mockConfigureGit = git.configureGit as jest.MockedFunction<typeof git.configureGit>
const mockCheckoutBranch = git.checkoutBranch as jest.MockedFunction<typeof git.checkoutBranch>
const mockCommitAndPush = git.commitAndPush as jest.MockedFunction<typeof git.commitAndPush>
const mockFindOpenPr = pr.findOpenPr as jest.MockedFunction<typeof pr.findOpenPr>
const mockFindOutdatedPrs = pr.findOutdatedPrs as jest.MockedFunction<typeof pr.findOutdatedPrs>
const mockCloseOutdatedPrs = pr.closeOutdatedPrs as jest.MockedFunction<typeof pr.closeOutdatedPrs>
const mockCreateOrGetPr = pr.createOrGetPr as jest.MockedFunction<typeof pr.createOrGetPr>

const OWNER = 'owner'
const REPO = 'repo'
const TOOL = 'actionlint'
const VERSION = '1.7.13'
const BRANCH = 'mise-upgrade/actionlint-1.7.13'
const PR_URL = `https://github.com/${OWNER}/${REPO}/pull/42`

const octokitMock = {
  rest: {
    repos: {
      get: jest.fn().mockResolvedValue({ data: { default_branch: 'main' } }),
    },
  },
}

beforeEach(() => {
  jest.clearAllMocks()

  mockGetInput.mockImplementation((name: string) => {
    const inputs: Record<string, string> = {
      token: 'gh-token',
      tool: TOOL,
      'branch-prefix': 'mise-upgrade',
      bump: 'true',
      labels: '',
      assignees: '',
    }
    return inputs[name] ?? ''
  })

  Object.defineProperty(github, 'context', {
    value: { repo: { owner: OWNER, repo: REPO } },
    configurable: true,
  })

  mockGetOctokit.mockReturnValue(octokitMock as never)

  mockValidateToolExists.mockResolvedValue()
  mockFindLatestVersion.mockResolvedValue(VERSION)
  mockUpgradeTool.mockResolvedValue()
  mockCurrentVersion.mockResolvedValue(VERSION)
  mockBranchName.mockReturnValue(BRANCH)
  mockSafeTool.mockReturnValue(TOOL)
  mockConfigureGit.mockResolvedValue()
  mockCheckoutBranch.mockResolvedValue()
  mockCommitAndPush.mockResolvedValue()
  mockFindOpenPr.mockResolvedValue(null)
  mockFindOutdatedPrs.mockResolvedValue([])
  mockCloseOutdatedPrs.mockResolvedValue()
  mockCreateOrGetPr.mockResolvedValue(PR_URL)
})

describe('run', () => {
  it('throws when tool does not exist in mise.toml', async () => {
    mockValidateToolExists.mockRejectedValue(new Error('Tool "actionlint" is not managed by mise'))
    await expect(run()).rejects.toThrow('Tool "actionlint" is not managed by mise')
    expect(mockFindLatestVersion).not.toHaveBeenCalled()
  })

  it('sets changed=false and returns early when tool is up to date', async () => {
    mockFindLatestVersion.mockResolvedValue(null)
    await run()
    expect(mockSetOutput).toHaveBeenCalledWith('changed', 'false')
    expect(mockUpgradeTool).not.toHaveBeenCalled()
  })

  it('upgrades tool and creates PR on the happy path', async () => {
    await run()
    expect(mockSetOutput).toHaveBeenCalledWith('changed', 'true')
    expect(mockUpgradeTool).toHaveBeenCalledWith(TOOL, true)
    expect(mockCreateOrGetPr).toHaveBeenCalled()
    expect(mockSetOutput).toHaveBeenCalledWith('pr-url', PR_URL)
  })

  it('returns early when an open PR already exists for this version', async () => {
    mockFindOpenPr.mockResolvedValue(42)
    await run()
    expect(mockSetOutput).toHaveBeenCalledWith('pr-url', `https://github.com/${OWNER}/${REPO}/pull/42`)
    expect(mockCheckoutBranch).not.toHaveBeenCalled()
    expect(mockCreateOrGetPr).not.toHaveBeenCalled()
  })

  it('closes outdated PRs before creating a new one', async () => {
    mockFindOutdatedPrs.mockResolvedValue([
      { number: 10, branch: 'mise-upgrade/actionlint-1.7.11' },
      { number: 11, branch: 'mise-upgrade/actionlint-1.7.12' },
    ])
    await run()
    expect(mockCloseOutdatedPrs).toHaveBeenCalledWith(
      expect.anything(),
      OWNER,
      REPO,
      [
        { number: 10, branch: 'mise-upgrade/actionlint-1.7.11' },
        { number: 11, branch: 'mise-upgrade/actionlint-1.7.12' },
      ],
    )
  })

  it('throws when currentVersion returns empty after upgrade', async () => {
    mockCurrentVersion.mockResolvedValue('')
    await expect(run()).rejects.toThrow(
      `Unable to determine current version for "${TOOL}" after upgrade`,
    )
  })

  it('sets MISE_INSTALL_BEFORE env var when install-before input is provided', async () => {
    const originalEnv = process.env['MISE_INSTALL_BEFORE']
    try {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'install-before') return '3d'
        const inputs: Record<string, string> = {
          token: 'gh-token',
          tool: TOOL,
          'branch-prefix': 'mise-upgrade',
          bump: 'true',
          labels: '',
          assignees: '',
        }
        return inputs[name] ?? ''
      })
      await run()
      expect(process.env['MISE_INSTALL_BEFORE']).toBe('3d')
    } finally {
      if (originalEnv === undefined) {
        delete process.env['MISE_INSTALL_BEFORE']
      } else {
        process.env['MISE_INSTALL_BEFORE'] = originalEnv
      }
    }
  })
})
