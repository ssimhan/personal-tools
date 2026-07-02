# Project Gotchas

## Personal lockfiles must not preserve employer-only registry hosts

**Pattern:** A package manager records the active corporate proxy in every lockfile `resolved` URL, even when all packages are public.

**Wrong:** Treat a cached install on the originating work laptop as proof that the personal repository is portable.

**Right:** Inspect all resolved hosts, normalize unexpected private-proxy URLs to the repository-approved public registry, and run a clean install with an explicit public-registry flag.

**Tell:** `npm config get registry` or the lockfile host inventory points to an internal firewall, Artifactory, Nexus, or corporate domain.

## Local Supabase requires an explicit container runtime

**Pattern:** Supabase CLI database and auth tests invoke Docker-compatible containers; installing the npm CLI alone is insufficient.

**Wrong:** Treat `npm install` as the complete local test setup.

**Right:** Start Docker Desktop or an equivalent runtime. The verified macOS path is `colima start --cpu 2 --memory 4 --disk 40`, followed by the reduced `supabase start -x ...` command in `README.md`.

**Tell:** Database tests fail on the Docker socket before a migration or pgTAP assertion runs.

## Auth redirects and session cookies must share one origin

**Pattern:** A cookie scoped to `127.0.0.1` is not sent to `localhost`, even though both reach the same development server.

**Wrong:** Derive post-verification redirects from a framework-normalized request URL while auth email uses a separately configured origin.

**Right:** Build auth email and confirmation redirects from `NEXT_PUBLIC_APP_URL`, and attach session cookies to the exact redirect response returned by the route handler.

**Tell:** Token verification succeeds and a session cookie is stored, but the protected route immediately returns to login.

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
