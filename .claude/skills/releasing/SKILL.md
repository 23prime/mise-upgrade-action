---
name: releasing
description: Release workflow for mise-upgrade-action. Use when the user wants to cut a new release. Runs mise run release, then updates the README SHA to match the tagged commit.
---

# Releasing mise-upgrade-action

## Steps

### 1. Show the current version and ask for the bump level

Run the following to get the current latest tag:

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "no tags yet"
```

Show the result to the user, then ask for the bump level (`major`, `minor`, or `patch`) if not already specified.

### 2. Run the release task

```bash
mise run release -- <major|minor|patch> --yes
```

`--yes` skips the interactive confirmation prompt. The script computes the next version, creates an annotated tag, and pushes.

### 3. Get the tagged commit SHA and version

```bash
git rev-parse HEAD
git describe --tags --abbrev=0
```

### 4. Update README.md

Replace **2 occurrences** of the pinned SHA — in the Usage snippet and the Full example:

```yaml
23prime/mise-upgrade-action@<sha> # <version>
```

Use the Edit tool to update both lines.

### 5. Commit and push

```bash
git add README.md
git commit -m "docs: Update SHA for <version>"
git push origin HEAD
```
