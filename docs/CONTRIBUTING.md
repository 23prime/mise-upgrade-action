# Contributing Guide

## Branch Strategy

### Branches

- `main`: Main (default) branch.
- `feature/xxxx`: Topic branch.

### Approval Flow

- Changes to the `main` branch are made exclusively through pull requests.
- Merging requires approval from at least one reviewer. Reviewers should be discussed and assigned as needed.

## Commit Messages

- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Scopes are optional. Use them when clarifying which part of the project is affected.
- Commit messages should be written in English.
- Commit message content:
  - Line 1: A concise summary of the change.
  - Line 3: (Optional) Reason for the change or non-obvious supplementary notes.

### Types

- `feat`: Feature additions or changes
- `fix`: Bug fixes or corrections
- `build`: Build tool configuration changes
- `ai`: AI configuration changes
- `ci`: CI configuration changes
- `docs`: Documentation changes
- `style`: Code style changes only
- `refactor`: Refactoring
- `perf`: Performance improvements
- `test`: Test additions or modifications
- `deps`: Dependency updates
- `chore`: Miscellaneous changes

### Scopes

Scopes are optional. Define them per project as needed. Examples for a monorepo:

- `backend`
- `frontend`
- `infra`
- `shared`

### Examples

```txt
feat(backend): Add user management API
```

```txt
chore: Update linter configuration
```

## TypeScript

The action logic (`src/`) is written in TypeScript and bundled into `dist/index.js` via `@vercel/ncc`.

- After modifying `src/`, the release task (`mise run release`) automatically rebuilds `dist/` and commits it before tagging.
- You do not need to manually run `mise run build` before releasing. CI does not verify dist freshness — the release task is the source of truth.

## Quality Assurance

- Consolidates all auto-fix commands into `mise fix`.
- Before committing, run the `mise fix` to auto-fix.
- If there are any errors that cannot be automatically fixed, fix them manually and verify that the `mise check` passes.

## Pull Requests

Create a pull request following the [template](../.github/PULL_REQUEST_TEMPLATE.md).

## Release

Releases are tag-based. The `dist/index.js` bundle is only updated at release time — `main` does not contain a built artifact between releases.

**Rule: release promptly after merging to `main`.**

Any merged PR that touches `src/` must be followed by a release before the dogfood workflow will reflect the change. Do not leave `main` in an unreleased state for extended periods.

### Version bump guidelines

- `patch` — Bug fixes, documentation updates, minor improvements
- `minor` — New features, backwards-compatible changes
- `major` — Breaking changes to action inputs/outputs/behavior

### How to release

```bash
mise run release -- <major|minor|patch>
```

The release task will:

1. Build `dist/` from the current `src/`
2. Commit the updated `dist/` if it changed
3. Prompt for confirmation, then create an annotated tag and push
4. CI picks up the tag and creates the GitHub Release with the floating major tag (e.g. `v1`)
