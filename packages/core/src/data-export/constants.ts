/** Short-lived signed GET URL lifetime for object-storage export downloads. */
export const DATA_EXPORT_DOWNLOAD_TTL_SECONDS = 15 * 60;

/** Persisted workspace export formats. */
export const DATA_EXPORT_FORMATS = ["ndjson"] as const;

export type DataExportFormat = (typeof DATA_EXPORT_FORMATS)[number];

/** Days to retain ready export files before cleanup removes them. */
export const DATA_EXPORT_FILE_RETENTION_DAYS = 7;

/** Maximum bytes streamed for a workspace export download. */
export const MAX_DATA_EXPORT_DOWNLOAD_BYTES = 50_000_000;

/** Maximum rows included in a single workspace export generation job. */
export const MAX_DATA_EXPORT_ROWS = 500_000;

/** Maximum bytes written while generating a workspace export. */
export const MAX_DATA_EXPORT_BYTES = 200_000_000;

/** Keyset page size when streaming tenant tables into an export. */
export const DATA_EXPORT_CHUNK_SIZE = 500;
