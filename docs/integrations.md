# Integration contracts

## Common ingestion path

All sources, whether uploaded manually or imported from Google Drive or Zoom, become the same records:

1. connector account
2. sync run
3. source document
4. source fragment
5. extracted evidence
6. proposed artifact
7. human review
8. measured outcome

This prevents connector-specific behavior from bypassing trust controls.

## Google Drive

The connection flow should:

- use OAuth, never a pasted password
- show the requested scopes before authorization
- let an administrator select approved folders
- import only new or changed files
- store provider file ID, version, modified time, content hash, and source URL
- preserve the original file in protected storage
- make extraction status visible
- require review before creating commitments or recommendations

Initial document types:

- PDF
- Google Docs
- Google Sheets
- presentations

## Zoom

The connection flow should:

- use OAuth with the minimum recording/transcript scopes
- let an administrator select meetings or a date range
- import transcript, recording metadata, attendees, and timestamps when available
- retain a link to the original Zoom source
- create proposed decisions and commitments, not final ones
- deduplicate repeated transcript imports by provider ID and content hash

## Permissions

The first permission roles are:

- owner: organization settings, connections, policies, and approvals
- leader: review and approve organizational artifacts
- committee lead: manage assigned events and commitments
- contributor: submit information and view permitted work
- viewer: read approved information only

Every connector and source document belongs to an organization. Cross-organization reads are prohibited by database policy.
