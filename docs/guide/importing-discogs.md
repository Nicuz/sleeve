---
title: Importing from Discogs
description: Export a Discogs collection as CSV and import it into Sleeve.
---

# Importing from Discogs

Sleeve imports the CSV that Discogs exports from your collection.

## Export from Discogs

1. Open your collection on Discogs.
2. Choose **Export** and download the CSV.
3. Keep the file as-is. Sleeve reads the standard column names.

## Import into Sleeve

1. Select **Import from Discogs** on the library page.
2. Select **Choose CSV** and pick the file.
3. Check the detected columns in **Map columns**.
4. Select **Import**.

Sleeve maps common Discogs columns automatically. **Title** and **Artist** are required; everything else is optional. The live preview shows what will be created before anything is written.

Rows without a title or artist are skipped. Releases already in the library are skipped as duplicates, so importing the same CSV twice is safe.

## After the import

Discogs CSV files do not contain MusicBrainz IDs or cover art. After importing:

1. Return to the library.
2. Use **Download metadata** on the missing-metadata banner.
3. Open individual releases and use **Search match** where the automatic match was skipped.

## Good to know

- Imports always merge. Existing releases are never overwritten.
- The CSV parser accepts up to 10,000 rows. Split larger exports into batches.
- Sleeve writes a database snapshot before an import starts.
- Condition, rating and purchase columns are imported when present.
- Genre values are split and stored as a comma-separated list.
- A very large CSV is still one request. Import in batches if the browser struggles.

Back up first with **Settings → Backup & restore → Download backup**.
