# Source extraction

The source pipeline uses the Supabase Edge Function `extract-source`.

It requires a signed-in contributor, committee lead, leader, or owner. The function verifies organization membership before reading the private `eagle-source-documents` bucket.

Supported formats:

- PDF text layers (`application/pdf`)
- Word DOCX paragraphs
- Excel XLSX and legacy XLS worksheets
- `text/plain`
- `text/csv`

The function limits extraction to 25 MB, creates organization-scoped paragraph fragments and source-backed `claimed` evidence records, then marks the source document `complete`. Empty files, unsupported formats, malformed office files, and extraction failures are marked `failed`.

The Review page can invoke the `recommend-source` Edge Function for a completed source. That worker sends only organization-scoped extracted evidence to the server-side OpenAI API, stores one `proposed` recommendation, and creates recommendation citations. It never approves, executes, or reverses an action.

Required Supabase Edge Function secret:

- `OPENAI_API_KEY`

The browser uses only the Supabase publishable key. The OpenAI key must never be added to `web/config.js`, `config.example.js`, or any browser bundle.
