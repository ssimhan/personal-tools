# Project Gotchas

## Clean subtree import does not merge ancestry

**Pattern:** Restoring one directory from a divergent branch onto a clean branch imports the desired files but does not make the old branch an ancestor of `main`.

**Wrong:** Assume the old branch's ahead/behind indicator will disappear after the clean subtree PR merges.

**Right:** Verify the desired subtree on `main`, archive the historical branch with a tag, then delete the obsolete branch separately.

**Tell:** GitHub still shows the historical branch both ahead and behind even though the imported files are present on `main`.

## GitHub CLI auth is independent of Git SSH auth

**Pattern:** `git push` can succeed through an SSH host alias while `gh pr create` remains unauthenticated.

**Wrong:** Treat a successful push as proof that GitHub CLI commands will work.

**Right:** Run `gh auth status` before prescribing a `gh pr create` workflow, or use the authenticated browser compare URL.

**Tell:** Git push succeeds, followed by “To get started with GitHub CLI, please run: gh auth login.”

## Untracked files are absent from ordinary diff statistics

**Pattern:** `git diff --stat` does not include untracked planning artifacts.

**Wrong:** Use an unstaged diff statistic as the completeness check for newly created docs.

**Right:** Inspect `git status`, stage intentionally, then run `git diff --cached --stat` and `git diff --cached --check`.

**Tell:** The working tree lists new files, but the diff statistic shows only modifications.
