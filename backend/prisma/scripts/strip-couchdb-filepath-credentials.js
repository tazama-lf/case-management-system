/*
  Strips credentials ("user:password@") from metadata[].filePath in every CouchDB evidence and report document.

  Dry run by default; --apply writes; --compact then drops old revisions, which still hold the credentials.
    node prisma/scripts/strip-couchdb-filepath-credentials.js [--apply] [--compact]

  Uses COUCHDB_URL, COUCHDB_USERNAME, COUCHDB_PASSWORD, COUCHDB_DATABASE (environment or backend/.env). Idempotent;
  conflicting documents are reported, so run again. Does not rotate COUCHDB_PASSWORD or clean backups.
*/
require('dotenv').config();
const nano = require('nano');

const CREDENTIALS = /^(https?:\/\/)[^/@]+@/;
const PAGE_SIZE = 200;
const apply = process.argv.includes('--apply');
const compact = process.argv.includes('--compact');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function connect() {
  const url = new URL(required('COUCHDB_URL'));
  url.username = encodeURIComponent(required('COUCHDB_USERNAME'));
  url.password = encodeURIComponent(required('COUCHDB_PASSWORD'));
  const server = nano(url.toString());
  const dbName = required('COUCHDB_DATABASE');
  return { server, dbName, db: server.use(dbName) };
}

/** Returns the document with credentials removed from metadata[].filePath, or null if there was nothing to remove. */
function stripped(doc) {
  if (!Array.isArray(doc.metadata)) {
    return null;
  }
  let changed = false;
  const metadata = doc.metadata.map((entry) => {
    if (entry && typeof entry.filePath === 'string' && CREDENTIALS.test(entry.filePath)) {
      changed = true;
      return { ...entry, filePath: entry.filePath.replace(CREDENTIALS, '$1') };
    }
    return entry;
  });
  return changed ? { ...doc, metadata } : null;
}

async function main() {
  const { server, dbName, db } = connect();
  let startkey;
  let scanned = 0;
  let affected = 0;
  let written = 0;
  let conflicts = 0;

  for (;;) {
    const page = await db.list({ include_docs: true, limit: PAGE_SIZE + 1, ...(startkey && { startkey }) });
    const rows = page.rows.slice(0, PAGE_SIZE);
    const next = page.rows[PAGE_SIZE];

    const updates = [];
    for (const row of rows) {
      if (row.id.startsWith('_design/') || !row.doc) {
        continue;
      }
      scanned += 1;
      const update = stripped(row.doc);
      if (update) {
        affected += 1;
        updates.push(update);
      }
    }

    if (apply && updates.length > 0) {
      const results = await db.bulk({ docs: updates });
      for (const result of results) {
        if (result.error) {
          conflicts += 1;
          console.error(`  not updated: ${result.id} (${result.error})`);
        } else {
          written += 1;
        }
      }
    }

    if (!next) {
      break;
    }
    startkey = next.id;
  }

  console.log(`${apply ? 'APPLIED' : 'DRY RUN'}: scanned ${scanned} documents, ${affected} contain credentials.`);
  if (apply) {
    console.log(`Updated ${written}; ${conflicts} not updated${conflicts > 0 ? ' - run again' : ''}.`);
    // Compact even when nothing was written: an earlier run without --compact leaves old revisions behind.
    if (compact) {
      await server.db.compact(dbName);
      console.log('Compaction started; old revisions are removed once it finishes.');
    } else if (written > 0) {
      console.log('Old revisions still hold the credentials until the database is compacted (--compact).');
    }
  } else if (affected > 0) {
    console.log('Re-run with --apply to remove them.');
  }
}

main().catch((error) => {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
});
