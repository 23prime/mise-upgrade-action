# Testing, Validation, and Error Handling

## Testing

### Framework

Jest + ts-jest. Tests live in `__tests__/` and follow the `*.test.ts` naming convention.

```bash
mise run ts-check   # type-check + test together
```

### File layout

| Test file | Covers |
| --- | --- |
| `__tests__/git.test.ts` | `safeTool()`, `branchName()` |
| `__tests__/outdated.test.ts` | `getOutdatedTools()`, `findLatestVersion()` |
| `__tests__/pr.test.ts` | `findOpenPr()`, `findOutdatedPrs()` |

### Mocking policy

Always mock external commands (`mise`, `git`) and the GitHub API. Never invoke real processes or network calls from tests.

### Mocking `@actions/exec`

```typescript
import * as exec from '@actions/exec'

jest.mock('@actions/exec')

const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>

mockExec.mockImplementation(async (_cmd, _args, options) => {
  options?.listeners?.stdout?.(Buffer.from(jsonString))
  return 0
})
```

### Mocking Octokit

Pass a minimal plain object cast to `never` — only stub the methods the function under test actually calls.

```typescript
function makeOctokit(prs: Array<{ number: number; head: { ref: string } }>) {
  return {
    rest: {
      pulls: {
        list: jest.fn().mockResolvedValue({ data: prs }),
      },
    },
  }
}

const result = await findOpenPr(octokit as never, 'owner', 'repo', 'branch')
```

### Guidelines

- Cover both the happy path and edge cases (tool already up-to-date, no matching PR, etc.).
- Each `describe` block corresponds to one module or function.
- `clearMocks: true` is set in `jest.config.js` — no need to reset mocks manually between tests.

---

## Validation

### Required inputs

`token` and `tool` are marked `required: true` in `action.yml` and passed `{ required: true }` to `@actions/core.getInput()`. If either is empty, `@actions/core` throws automatically and fails the action.

```typescript
const token = core.getInput('token', { required: true })
const tool = core.getInput('tool', { required: true })
```

### Optional inputs

Defaults are declared in `action.yml`. Code-level fallbacks are only used when the value can legitimately be an empty string after the default is applied.

```typescript
const branchPrefix = core.getInput('branch-prefix') || 'mise-upgrade'
```

Comma-separated list inputs are normalized with `split` → `trim` → `filter(Boolean)`.

```typescript
const labels = core.getInput('labels').split(',').map((s) => s.trim()).filter(Boolean)
```

### Branch name sanitization

Tool names can contain special characters (e.g. `github:owner/repo`). `safeTool()` replaces any character outside `[a-zA-Z0-9._-]` with a hyphen to produce a valid branch name segment.

```typescript
// 'github:owner/repo' → 'github-owner-repo'
export function safeTool(tool: string): string {
  return tool.replace(/[^a-zA-Z0-9._-]/g, '-')
}
```

---

## Error Handling

### Top-level catch

The entrypoint in `src/index.ts` catches all unhandled errors and forwards them to `core.setFailed()`. Individual functions can throw freely — everything propagates up to this single handler.

```typescript
run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
})
```

### External command failures

`@actions/exec` throws automatically on a non-zero exit code. Failures from `mise upgrade`, `git push`, etc. propagate as action failures without any extra handling.

### PR creation conflict

If the Octokit `pulls.create` call fails (e.g. a PR for the same branch already exists), the code falls back to fetching the existing PR URL instead of re-throwing.

```typescript
try {
  const { data } = await octokit.rest.pulls.create({ ... })
  prUrl = data.html_url
} catch {
  const existing = await octokit.rest.pulls.list({ head: `${owner}:${branch}`, state: 'open' })
  if (!existing.data[0]) throw new Error(`Failed to create PR and no existing PR found`)
  prUrl = existing.data[0].html_url
}
```

### Intentional skips

When skipping is expected behavior (tool already up-to-date, open PR already exists for this version), log with `core.info()` and `return`. Do not call `core.setFailed()`.
