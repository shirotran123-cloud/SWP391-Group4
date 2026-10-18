# Maintenance tools

Small utilities for keeping the demo data and its text encoding healthy. All of them are
plain Python 3 with no third-party dependencies — they only use the standard library plus
`docker exec` for the PostgreSQL steps.

Run them from anywhere; each one resolves the repository root from its own location.

| Script | Purpose |
|:---|:---|
| `seed-accounts.py` | Create/refresh the 13 demo accounts (ADMIN, HOD, LECTURER, STUDENT) and set the shared password `Aita@2026` in both the JSON store and PostgreSQL. |
| `verify-api-text.py` | Assert that no field in any API response contains text with lost diacritics. Exits non-zero on failure, so it can gate a build. |
| `repair-submissions.py` | Repair `matchedStudentName` values inside `api-gateway/data/submissions_store.json`. |
| `repair-db-details.py` | Repair the same names inside the `submissions.details` jsonb column in PostgreSQL. |

## Why these exist

Two different text-corruption bugs bit this project, and they need different tools:

1. **Mojibake** — UTF-8 text decoded as cp1252 and re-encoded, so `Tuần` becomes `Tuáº§n`.
   Caused by `Get-Content | Set-Content` in Windows PowerShell. Fix: rewrite the file with an
   explicit UTF-8 encoder; never round-trip Vietnamese text through PowerShell's pipeline.

2. **Lost diacritics** — text encoded as Latin-1, so unmappable characters became `?` and
   invalid bytes became `U+FFFD` (`Qu?n Tr? Vi�n AITA`). Caused by
   `Invoke-RestMethod -Body <string>` in Windows PowerShell 5.1, which sends a Latin-1 body.
   This is why `seed-accounts.py` exists: it sends every request with an explicit UTF-8 body.

A mojibake regex cannot detect the second bug, because the bytes are gone rather than
mis-decoded. `verify-api-text.py` checks for both patterns.

## Text integrity check

```bash
# no field in the API may contain lost diacritics
python tools/verify-api-text.py

# PostgreSQL: the grading payload must be clean too
docker exec aita-postgres psql -U aita_admin -d aita_autograding -t -A -c \
  "SELECT count(*) FROM submissions WHERE details::text LIKE '%' || chr(65533) || '%';"

# source files must be valid UTF-8 and free of mojibake
python tools/verify-api-text.py
```

## Order of operations when repairing corruption

The gateway caches the stores in memory and writes them back, so it will overwrite a repair
made while it is running:

1. Stop the API Gateway.
2. Run `repair-submissions.py` (JSON store).
3. Run `repair-db-details.py` (PostgreSQL).
4. Start the API Gateway again and run `verify-api-text.py`.
