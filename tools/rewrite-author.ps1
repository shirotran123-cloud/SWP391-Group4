"""Rewrites ONLY your commits to your real GitHub identity.

Every commit made through this project carried a placeholder address
(`trungdt@aita.fpt.edu.vn`), which GitHub cannot link to an account. This rewrites the author
and committer of those commits to the real Gmail, leaving the other four members untouched.

It uses `git filter-branch --env-filter`, which is bundled with git and therefore cannot fail
on a missing dependency. A backup tag (`backup-before-author-rewrite`) must exist before it
runs, so the original history is always recoverable.

Usage:  pwsh -File tools/rewrite-author.ps1
"""
$ErrorActionPreference = 'Stop'

# ── Identity ────────────────────────────────────────────────────────────────
$OLD_NAME  = 'Đinh Thanh Trung'
$OLD_EMAIL = 'trungdt@aita.fpt.edu.vn'
$NEW_NAME  = 'TrungDinh15'
$NEW_EMAIL = 'lqd.sik22.dinhthanhtrung@gmail.com'

# ── Safety: a backup tag must exist ─────────────────────────────────────────
$tags = git tag --list 'backup-before-author-rewrite'
if (-not $tags) {
    Write-Host 'Refusing to run: create the backup tag first.' -ForegroundColor Red
    Write-Host '  git tag -f backup-before-author-rewrite HEAD'
    exit 1
}

Write-Host '=== Rewriting author of your commits only ===' -ForegroundColor Cyan
Write-Host ("  from : {0} <{1}>" -f $OLD_NAME, $OLD_EMAIL)
Write-Host ("  to   : {0} <{1}>" -f $NEW_NAME, $NEW_EMAIL)
Write-Host ''

# ── The rewrite ─────────────────────────────────────────────────────────────
# Only commits whose author OR committer matches the old identity are touched. Comparing the
# email is what protects the other members: their addresses never appear in OLD_EMAIL.
$env:FILTER_BRANCH_SQUELCH_WARNING = '1'

$filterScript = @"
if [ "`$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ] || [ "`$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]; then
  export GIT_AUTHOR_NAME="$NEW_NAME"
  export GIT_AUTHOR_EMAIL="$NEW_EMAIL"
  export GIT_COMMITTER_NAME="$NEW_NAME"
  export GIT_COMMITTER_EMAIL="$NEW_EMAIL"
fi
"@

git filter-branch --force --env-filter $filterScript -- --all 2>&1 | Select-Object -Last 12

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Rewrite failed. Your history is unchanged; the backup tag is still valid.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '=== Result ===' -ForegroundColor Cyan
Write-Host '--- authors now in history ---'
git log --format='%an <%ae>' | Sort-Object -Unique | ForEach-Object { "  $_" }

Write-Host ''
$mine = (git log --author=$NEW_EMAIL --oneline | Measure-Object -Line).Lines
Write-Host ("  commits under {0}: {1}" -f $NEW_EMAIL, $mine)

$leftover = (git log --author=$OLD_EMAIL --oneline | Measure-Object -Line).Lines
if ($leftover -gt 0) {
    Write-Host ("  WARNING: {0} commit(s) still use the old address" -f $leftover) -ForegroundColor Yellow
} else {
    Write-Host '  no commits left with the old address' -ForegroundColor Green
}
