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
  if (exitCode !== 0 || trimmed === '' || trimmed === '{}' || trimmed === '[]') {
    throw new Error(`Tool "${tool}" is not managed by mise. Add it to mise.toml first.`)
  }

  try {
    JSON.parse(trimmed)
  } catch (err) {
    throw new Error(`Failed to parse \`mise ls\` output for "${tool}".`, { cause: err })
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
