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

- After modifying `src/`, run `mise run build` and commit `dist/index.js` together with your source changes.
- The pre-commit hook runs `mise check`, which includes `dist-check` — it builds and verifies that `dist/index.js` is up to date. The commit will be rejected if `dist/index.js` is stale.
- CI also runs `dist-check` to verify the committed `dist/index.js` matches a fresh build.

## Quality Assurance

- Consolidates all auto-fix commands into `mise fix`.
- Before committing, run the `mise fix` to auto-fix.
- If there are any errors that cannot be automatically fixed, fix them manually and verify that the `mise check` passes.

## Pull Requests

Create a pull request following the [template](../.github/PULL_REQUEST_TEMPLATE.md).

## Release

Releases are tag-based. `dist/index.js` is committed alongside every `src/` change (see [TypeScript](#typescript) above), so `main` always contains an up-to-date artifact.

**Rule: release promptly after merging to `main`.**

Do not leave `main` in an unreleased state for extended periods.

### Version bump guidelines

- `patch` — Bug fixes, documentation updates, minor improvements
- `minor` — New features, backwards-compatible changes
- `major` — Breaking changes to action inputs/outputs/behavior

### How to release

```bash
mise run release -- <major|minor|patch>
```

The release task will:

1. Run `mise run build` and verify `dist/index.js` is up to date (fails if stale)
2. Prompt for confirmation, then create an annotated tag and push
3. CI picks up the tag and creates the GitHub Release with the floating major tag (e.g. `v1`)
