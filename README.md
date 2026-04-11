# mise-upgrade-action

A GitHub Action that upgrades a single [mise](https://mise.jdx.dev)-managed tool and opens a pull request.
Combine with a matrix strategy to upgrade all tools in parallel, one PR per tool.

## How it works

1. Detects if the tool is outdated using `mise outdated --bump --local`
2. Runs `mise upgrade --bump` to upgrade — version constraints in `mise.toml` are updated beyond the current constraint
3. If an open PR already exists for the same tool at the same version, skips without error; if open PRs exist for older versions of the same tool, closes them first
4. Commits `mise.toml` and `mise.lock`, then opens a PR

Branch names follow the pattern `{branch-prefix}/{tool}-{version}` (e.g. `mise-upgrade/actionlint-1.7.13`).

## Examples

### Auto matrix from `mise outdated`

Automatically detects outdated tools and upgrades each in a separate job.

```yaml
name: mise upgrade

on:
  schedule:
    - cron: '0 0 * * 1' # Every Monday
  workflow_dispatch:

permissions: {}

jobs:
  list-outdated:
    runs-on: ubuntu-latest
    outputs:
      tools: ${{ steps.list.outputs.tools }}
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false

      - uses: jdx/mise-action@1648a7812b9aeae629881980618f079932869151 # v4.0.1
        with:
          install: true
          cache: true
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - name: List outdated tools
        id: list
        run: |
          tools=$(mise outdated --bump --local --json | jq -c '[.[].name]')
          echo "tools=${tools}" >> "$GITHUB_OUTPUT"

  upgrade:
    needs: list-outdated
    if: needs.list-outdated.outputs.tools != '[]'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    strategy:
      matrix:
        tool: ${{ fromJson(needs.list-outdated.outputs.tools) }}
      fail-fast: false
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: 23prime/mise-upgrade-action@29bb9d91b17ab94956568f6dc4e1a0cbceec3b61 # v0.1.2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          tool: ${{ matrix.tool }}
```

### Manual matrix

Upgrade a fixed set of tools.

```yaml
jobs:
  upgrade:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    strategy:
      matrix:
        tool: [actionlint, shellcheck, lefthook]
      fail-fast: false
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: 23prime/mise-upgrade-action@29bb9d91b17ab94956568f6dc4e1a0cbceec3b61 # v0.1.2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          tool: ${{ matrix.tool }}
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `token` | Yes | — | GitHub token. Needs `contents: write` and `pull-requests: write`. |
| `tool` | Yes | — | Tool name to upgrade (as it appears in `mise.toml`). |
| `branch-prefix` | No | `mise-upgrade` | Branch name prefix (e.g. `mise-upgrade/actionlint-1.7.13`). |
| `labels` | No | `` | Comma-separated labels to add to the PR. |
| `assignees` | No | `` | Comma-separated assignees for the PR. |
| `bump` | No | `true` | Pass `--bump` to `mise upgrade` to update version constraints in `mise.toml`. |
| `pr-title` | No | `deps: Upgrade {tool} to {version}` | PR title template. Supports `{tool}` and `{version}` placeholders. |
| `pr-body` | No | `Automated upgrade of {tool} to {version}.` | PR body template. Supports `{tool}` and `{version}` placeholders. |
| `install-before` | No | `` | Minimum age of a tool release before it is eligible for upgrade (e.g. `3d`, `1w`). Forwarded to mise as `MISE_INSTALL_BEFORE`. Reduces supply chain risk by avoiding immediately-released versions. |

## Outputs

| Name | Description |
| --- | --- |
| `pr-url` | URL of the created or updated pull request. |
| `changed` | `"true"` if the tool version changed after the upgrade. |

## Troubleshooting

### Token permission errors

The action requires `contents: write` and `pull-requests: write`. If you use
the `labels` or `assignees` inputs, it also requires `issues: write` to update
PR labels/assignees via the GitHub Issues API. If you see `GitHub API
authentication failed (401)` or other permission-related failures such as `403`,
check that the token is passed correctly and the job has the required
permissions declared.

### Tool not found in `mise.toml`

If the tool name does not exist in `mise.toml`, the action fails with:
`Tool "<name>" is not managed by mise. Add it to mise.toml first.`
Add the tool to `mise.toml` (e.g. `mise use actionlint`) before running the action.

### No upgrades available

When the tool is already at the latest version, the action exits early and sets
`changed: "false"`. No commit or PR is created. This is expected behavior.

### Rate limit errors when running a matrix

Running many matrix jobs in parallel can hit GitHub API rate limits.
The action surfaces these as `GitHub API rate limit or permission error (429)` or
`GitHub API rate limit or permission error (403)`.

A `429` usually indicates rate limiting. A `403` can also happen due to rate
limiting or abuse protection, and may indicate missing token permissions
(for example, `issues: write` when using labels or assignees).
Add `max-parallel` to your matrix strategy to limit concurrency, stagger runs,
and verify the token has the required permissions.

### PR already exists for the same version

If an open PR already exists for the same tool at the same version, the action
skips creating a new one and outputs the existing PR's URL. No duplicate PRs are
created. PRs for *older* versions of the same tool are closed automatically.
