import * as exec from '@actions/exec'

export interface OutdatedEntry {
  name: string
  version: string
  latest: string
}

export async function getOutdatedTools(): Promise<OutdatedEntry[]> {
  let stdout = ''
  await exec.exec('mise', ['outdated', '--bump', '--local', '--json'], {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString()
      },
    },
    silent: true,
  })
  const parsed: unknown = JSON.parse(stdout)
  if (Array.isArray(parsed)) return parsed as OutdatedEntry[]
  return Object.values(parsed as Record<string, OutdatedEntry>)
}

export async function findLatestVersion(tool: string): Promise<string | null> {
  const entries = await getOutdatedTools()
  const entry = entries.find((e) => e.name === tool)
  return entry?.latest ?? null
}
