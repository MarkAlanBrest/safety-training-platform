-- Neon SQL Editor cleanup for unused video / classroom bulk data.
-- Keeps SCORM/PDF courses and AdminUser rows.
-- Note: this does NOT reset monthly data-transfer quota. If SELECT 1 fails with
-- "exceeded the data transfer quota", upgrade Neon or wait for reset first.

-- Preview sizes
SELECT "courseType", COUNT(*) FROM "MasonCourse" GROUP BY 1;
SELECT "mimeType", COUNT(*) AS rows, pg_size_pretty(SUM(octet_length(content))) AS bytes
FROM "ScormAsset"
GROUP BY 1
ORDER BY SUM(octet_length(content)) DESC NULLS LAST;

-- Deletes
DELETE FROM "ScormAsset" WHERE "mimeType" LIKE 'video/%';
DELETE FROM "ScormAsset" WHERE "path" LIKE 'classroom/uploads/%';
DELETE FROM "MasonCourse" WHERE "courseType" = 'classroom';
TRUNCATE TABLE "SpeechCache";
