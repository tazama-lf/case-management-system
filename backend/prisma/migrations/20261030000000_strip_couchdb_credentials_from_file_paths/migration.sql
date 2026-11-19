/*
  Removes CouchDB credentials ("http://user:password@host/...") that CouchdbService.insertAttachment used to put
  into attachment URLs. Only the user-info part is removed; scheme, host, database, document id and file name stay.

  - evidence.file_path        the URL itself
  - evidence.metadata         the copy of the CouchDB document, whose metadata[].filePath held the same URL
  - reports.report_file_path  same shape, in case it was ever filled from an attachment URL

  Idempotent: rows without credentials are not touched. Not reversible - the credentials are the thing being
  removed. This does NOT remove them from CouchDB itself (run prisma/scripts/strip-couchdb-filepath-credentials.js)
  or from backups, and COUCHDB_PASSWORD still has to be rotated.
*/

UPDATE "evidence"
SET "file_path" = regexp_replace("file_path", '^(https?://)[^/@]+@', '\1')
WHERE "file_path" ~ '^https?://[^/@]+@';

UPDATE "evidence"
SET "metadata" = jsonb_set(
  "metadata",
  '{metadata}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(f.elem -> 'filePath') = 'string'
          THEN jsonb_set(f.elem, '{filePath}', to_jsonb(regexp_replace(f.elem ->> 'filePath', '^(https?://)[^/@]+@', '\1')))
        ELSE f.elem
      END
      ORDER BY f.ord
    )
    FROM jsonb_array_elements("metadata" -> 'metadata') WITH ORDINALITY AS f(elem, ord)
  )
)
WHERE jsonb_typeof("metadata" -> 'metadata') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("metadata" -> 'metadata') AS g(elem)
    WHERE g.elem ->> 'filePath' ~ '^https?://[^/@]+@'
  );

UPDATE "reports"
SET "report_file_path" = regexp_replace("report_file_path", '^(https?://)[^/@]+@', '\1')
WHERE "report_file_path" ~ '^https?://[^/@]+@';
