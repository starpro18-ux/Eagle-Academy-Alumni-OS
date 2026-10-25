# Web source ingestion

The repository includes a small authenticated upload surface at `web/ingest.html`. It is intentionally separate from the demo dashboard.

## Local setup

1. Copy `web/config.example.js` to `web/config.js`.
2. Set `url` to the Supabase project URL and `publishableKey` to the browser-safe publishable key.
3. Serve `web/` over HTTP; do not open the page from `file://`.
4. Open `/onboarding.html` to authenticate and bootstrap the first organization.
5. Open `/ingest.html` to upload source documents.

Never put a service-role key in `config.js`, browser code, or a static host.

## Upload contract

The page accepts PDF, DOCX, XLSX, XLS, CSV, and plain-text files up to 50 MB. It creates a `source_documents` row before uploading to the private `eagle-source-documents` bucket. The object path is:

```
{organization_id}/{source_document_id}/{safe_filename}
```

Database and Storage RLS enforce that the signed-in user is an organization member and has a contributor-level role for writes. The page only lists rows visible to the current organization. Uploaded rows remain `extraction_status = 'pending'` until the extraction worker is connected.

Configure the Supabase Auth redirect URL to include the exact URL used for `onboarding.html` and `ingest.html` during local or hosted testing.
