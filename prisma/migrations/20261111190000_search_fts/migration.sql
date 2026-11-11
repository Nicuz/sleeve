-- Full-text index for library search.
CREATE VIRTUAL TABLE "ReleaseSearch" USING fts5(
  release_id UNINDEXED,
  title,
  artist,
  label,
  catalog,
  genres,
  tracks,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO "ReleaseSearch" (
  release_id,
  title,
  artist,
  label,
  catalog,
  genres,
  tracks
)
SELECT
  r.id,
  r.title,
  r.artist,
  coalesce(r.label, ''),
  coalesce(r.catalogNumber, ''),
  coalesce(r.genres, ''),
  coalesce(group_concat(t.title, ' '), '')
FROM "Release" r
LEFT JOIN "Track" t ON t.releaseId = r.id
GROUP BY r.id;

CREATE TRIGGER "ReleaseSearch_release_insert"
AFTER INSERT ON "Release"
BEGIN
  INSERT INTO "ReleaseSearch" (
    release_id,
    title,
    artist,
    label,
    catalog,
    genres,
    tracks
  )
  VALUES (
    new.id,
    new.title,
    new.artist,
    coalesce(new.label, ''),
    coalesce(new.catalogNumber, ''),
    coalesce(new.genres, ''),
    ''
  );
END;

CREATE TRIGGER "ReleaseSearch_release_update"
AFTER UPDATE ON "Release"
BEGIN
  DELETE FROM "ReleaseSearch" WHERE release_id = old.id;
  INSERT INTO "ReleaseSearch" (
    release_id,
    title,
    artist,
    label,
    catalog,
    genres,
    tracks
  )
  SELECT
    r.id,
    r.title,
    r.artist,
    coalesce(r.label, ''),
    coalesce(r.catalogNumber, ''),
    coalesce(r.genres, ''),
    coalesce(group_concat(t.title, ' '), '')
  FROM "Release" r
  LEFT JOIN "Track" t ON t.releaseId = r.id
  WHERE r.id = new.id
  GROUP BY r.id;
END;

CREATE TRIGGER "ReleaseSearch_release_delete"
AFTER DELETE ON "Release"
BEGIN
  DELETE FROM "ReleaseSearch" WHERE release_id = old.id;
END;

CREATE TRIGGER "ReleaseSearch_track_insert"
AFTER INSERT ON "Track"
BEGIN
  DELETE FROM "ReleaseSearch" WHERE release_id = new.releaseId;
  INSERT INTO "ReleaseSearch" (
    release_id,
    title,
    artist,
    label,
    catalog,
    genres,
    tracks
  )
  SELECT
    r.id,
    r.title,
    r.artist,
    coalesce(r.label, ''),
    coalesce(r.catalogNumber, ''),
    coalesce(r.genres, ''),
    coalesce(group_concat(t.title, ' '), '')
  FROM "Release" r
  LEFT JOIN "Track" t ON t.releaseId = r.id
  WHERE r.id = new.releaseId
  GROUP BY r.id;
END;

CREATE TRIGGER "ReleaseSearch_track_update"
AFTER UPDATE OF "releaseId", "title" ON "Track"
BEGIN
  DELETE FROM "ReleaseSearch"
  WHERE release_id = old.releaseId OR release_id = new.releaseId;
  INSERT INTO "ReleaseSearch" (
    release_id,
    title,
    artist,
    label,
    catalog,
    genres,
    tracks
  )
  SELECT
    r.id,
    r.title,
    r.artist,
    coalesce(r.label, ''),
    coalesce(r.catalogNumber, ''),
    coalesce(r.genres, ''),
    coalesce(group_concat(t.title, ' '), '')
  FROM "Release" r
  LEFT JOIN "Track" t ON t.releaseId = r.id
  WHERE r.id IN (old.releaseId, new.releaseId)
  GROUP BY r.id;
END;

CREATE TRIGGER "ReleaseSearch_track_delete"
AFTER DELETE ON "Track"
BEGIN
  DELETE FROM "ReleaseSearch" WHERE release_id = old.releaseId;
  INSERT INTO "ReleaseSearch" (
    release_id,
    title,
    artist,
    label,
    catalog,
    genres,
    tracks
  )
  SELECT
    r.id,
    r.title,
    r.artist,
    coalesce(r.label, ''),
    coalesce(r.catalogNumber, ''),
    coalesce(r.genres, ''),
    coalesce(group_concat(t.title, ' '), '')
  FROM "Release" r
  LEFT JOIN "Track" t ON t.releaseId = r.id
  WHERE r.id = old.releaseId
  GROUP BY r.id;
END;
