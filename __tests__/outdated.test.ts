import * as exec from '@actions/exec'
import { getOutdatedTools, findLatestVersion } from '../src/outdated'

jest.mock('@actions/exec')

const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>

const OUTDATED_JSON_ARRAY = JSON.stringify([
  { name: 'actionlint', version: '1.7.12', latest: '1.7.13' },
  { name: 'shellcheck', version: '0.11.0', latest: '0.11.1' },
])

const OUTDATED_JSON_OBJECT = JSON.stringify({
  actionlint: { name: 'actionlint', version: '1.7.12', latest: '1.7.13' },
  shellcheck: { name: 'shellcheck', version: '0.11.0', latest: '0.11.1' },
})

function setupExecMock(json: string): void {
  mockExec.mockImplementation(async (_cmd, _args, options) => {
    options?.listeners?.stdout?.(Buffer.from(json))
    return 0
  })
}

describe('getOutdatedTools', () => {
  it('parses array format', async () => {
    setupExecMock(OUTDATED_JSON_ARRAY)
    const result = await getOutdatedTools()
    expect(result).toEqual([
      { name: 'actionlint', version: '1.7.12', latest: '1.7.13' },
      { name: 'shellcheck', version: '0.11.0', latest: '0.11.1' },
    ])
  })

  it('parses object format', async () => {
    setupExecMock(OUTDATED_JSON_OBJECT)
    const result = await getOutdatedTools()
    expect(result).toEqual(
      expect.arrayContaining([
        { name: 'actionlint', version: '1.7.12', latest: '1.7.13' },
        { name: 'shellcheck', version: '0.11.0', latest: '0.11.1' },
      ]),
    )
  })
})

describe('findLatestVersion', () => {
  it('returns latest version for a known tool', async () => {
    setupExecMock(OUTDATED_JSON_ARRAY)
    expect(await findLatestVersion('actionlint')).toBe('1.7.13')
  })

  it('returns null for an up-to-date tool', async () => {
    setupExecMock(OUTDATED_JSON_ARRAY)
    expect(await findLatestVersion('lefthook')).toBeNull()
  })
})
