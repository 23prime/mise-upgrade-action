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

## Outputs

| Name | Description |
| --- | --- |
| `pr-url` | URL of the created or updated pull request. |
| `changed` | `"true"` if the tool version changed after the upgrade. |
