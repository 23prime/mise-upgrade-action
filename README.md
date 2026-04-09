# mise-upgrade-action

A GitHub Action that upgrades a single [mise](https://mise.jdx.dev)-managed tool and opens a pull request.
Combine with a matrix strategy to upgrade all tools in parallel, one PR per tool.

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
          install: false

      - name: List outdated tools
        id: list
        run: |
          tools=$(mise outdated --json | jq '[.[].name]')
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

      - uses: 23prime/mise-upgrade-action@19fcc3cb713749e659ffbea65f1ff041c1d65e1c # v0.1.0
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

      - uses: 23prime/mise-upgrade-action@19fcc3cb713749e659ffbea65f1ff041c1d65e1c # v0.1.0
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
