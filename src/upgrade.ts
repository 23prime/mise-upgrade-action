import * as exec from '@actions/exec'

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
