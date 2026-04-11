# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## General agent rules

- When users ask questions, answer them instead of doing the work.

### Shell Rules

- Always use `rm -f` (never bare `rm`)
- Before running a series of `git` commands, confirm you are in the project root; if not, `cd` there first. Then run all subsequent `git` commands from that directory without the `-C` option.

## Project Overview

A GitHub Action (`action.yml`) that upgrades a single [mise](https://mise.jdx.dev)-managed tool and opens a pull request.
Combine with a matrix strategy to upgrade all tools in parallel, one PR per tool.

## Setup

```bash
mise run setup   # trust, install tools, install pnpm deps, install lefthook hooks
```

## Tasks

| Alias | Task | Description |
| --- | --- | --- |
| `s` | `setup` | Trust mise, install tools, install pnpm deps, install lefthook |
| `f` | `fix` | Fix all issues (Markdown + GitHub Actions) |
| `c` | `check` | Check all issues (Markdown + GitHub Actions + spell + TypeScript + tests) |
| `fc` | `fix-and-check` | Fix then check |
| `mf` | `md-fix` | Fix Markdown issues |
| `mc` | `md-check` | Check Markdown issues |
| `ghf` | `gh-fix` | Fix GitHub Actions workflows (zizmor) |
| `ghc` | `gh-check` | Check GitHub Actions (actionlint + zizmor) |
| `sc` | `spell-check` | Check spelling (cspell) |
| `i` | `install` | Install Node.js dependencies (frozen lockfile) |
| `b` | `build` | Build TypeScript → dist/ |
| `tc` | `ts-check` | Type-check TypeScript and run tests |
| `dc` | `dist-check` | Check that dist/index.js is up to date with src/ |

## Git Hooks

Both `pre-commit` and `pre-push` run `mise check` via lefthook. `mise check` includes `dist-check`, which builds and verifies that `dist/index.js` is up to date with `src/`.

## Code Style

- Markdown: dashes for lists (`-`), asterisks for emphasis/strong (`*`), 2-space indent
- YAML/TOML/JSON: 2-space indent, LF line endings
