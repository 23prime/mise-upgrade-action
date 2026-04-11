import * as exec from '@actions/exec'

export async function validateToolExists(tool: string): Promise<void> {
  let stdout = ''
  let exitCode: number
  try {
    exitCode = await exec.exec('mise', ['ls', '--current', '--json', tool], {
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString()
        },
      },
      silent: true,
      ignoreReturnCode: true,
    })
  } catch {
    throw new Error(`Tool "${tool}" is not managed by mise. Add it to mise.toml first.`)
  }
  if (exitCode !== 0 || stdout.trim() === '{}' || stdout.trim() === '[]' || stdout.trim() === '') {
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
