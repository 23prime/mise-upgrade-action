import * as exec from '@actions/exec'

export async function validateToolExists(tool: string): Promise<void> {
  let stdout = ''
  const exitCode = await exec.exec('mise', ['ls', '--current', '--json', tool], {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString()
      },
    },
    silent: true,
    ignoreReturnCode: true,
  })

  const trimmed = stdout.trim()
  if (exitCode !== 0 || trimmed === '') {
    throw new Error(`Tool "${tool}" is not managed by mise. Add it to mise.toml first.`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (err) {
    throw new Error(`Failed to parse \`mise ls\` output for "${tool}".`, { cause: err })
  }

  const isEmptyObject =
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    Object.keys(parsed as Record<string, unknown>).length === 0
  const isEmptyArray = Array.isArray(parsed) && parsed.length === 0

  if (isEmptyObject || isEmptyArray) {
    throw new Error(`Tool "${tool}" is not managed by mise. Add it to mise.toml first.`)
  }
}

export async function upgradeTool(tool: string, bump: boolean): Promise<void> {
  const args = ['upgrade']
  if (bump) args.push('--bump')
  args.push(tool)
  await exec.exec('mise', args)
}

export async function currentVersion(tool: string): Promise<string> {
  let stdout = ''
  await exec.exec('mise', ['current', tool], {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString()
      },
    },
    silent: true,
  })
  return stdout.trim()
}
