# Source extraction

The first extraction pass is available through the Supabase Edge Function `extract-source`.

It requires a signed-in contributor, committee lead, leader, or owner. The function verifies the user's organization membership before reading the private `eagle-source-documents` bucket.

Supported formats:

- `text/plain`
- `text/csv`

The function creates organization-scoped paragraph fragments and source-backed `claimed` evidence records, then marks the source document `complete`. Empty files, files over 5 MB, unsupported formats, and extraction failures are marked `failed` with a user-facing error.

PDF, Word, and Excel uploads remain stored and protected, but require the next parser implementation.