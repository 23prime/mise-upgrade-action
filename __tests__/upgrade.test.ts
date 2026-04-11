import * as exec from '@actions/exec'
import { upgradeTool, currentVersion } from '../src/upgrade'

jest.mock('@actions/exec')

const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('upgradeTool', () => {
  it('runs mise upgrade <tool> when bump is false', async () => {
    mockExec.mockResolvedValue(0)
    await upgradeTool('actionlint', false)
    expect(mockExec).toHaveBeenCalledWith('mise', ['upgrade', 'actionlint'])
  })

  it('runs mise upgrade --bump <tool> when bump is true', async () => {
    mockExec.mockResolvedValue(0)
    await upgradeTool('node', true)
    expect(mockExec).toHaveBeenCalledWith('mise', ['upgrade', '--bump', 'node'])
  })

  it('propagates exec errors', async () => {
    mockExec.mockRejectedValue(new Error('mise not found'))
    await expect(upgradeTool('actionlint', false)).rejects.toThrow('mise not found')
  })
})

describe('currentVersion', () => {
  function setupExecMock(output: string): void {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from(output))
      return 0
    })
  }

  it('returns trimmed stdout from mise current', async () => {
    setupExecMock('1.7.13\n')
    const result = await currentVersion('actionlint')
    expect(result).toBe('1.7.13')
    expect(mockExec).toHaveBeenCalledWith('mise', ['current', 'actionlint'], expect.any(Object))
  })

  it('returns empty string when mise current returns nothing', async () => {
    setupExecMock('')
    const result = await currentVersion('actionlint')
    expect(result).toBe('')
  })

  it('propagates exec errors', async () => {
    mockExec.mockRejectedValue(new Error('exec failed'))
    await expect(currentVersion('actionlint')).rejects.toThrow('exec failed')
  })
})
