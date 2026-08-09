/** Max SCORM package size (chunked upload). Keep in sync with server chunk caps. */
export const MAX_SCORM_ZIP_BYTES = 200 * 1024 * 1024;

export function maxScormZipMb() {
  return Math.floor(MAX_SCORM_ZIP_BYTES / (1024 * 1024));
}
