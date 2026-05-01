/**
 * sheets.ts — generic utilities for fetching and parsing CSV data
 * published from Google Sheets.
 *
 * Why hand-roll a CSV parser instead of pulling in a library?
 *   - We deliberately keep deps minimal in this project
 *   - Google's published CSVs are well-formed and predictable
 *   - We need ~50 lines of code; a library would add ~30KB to the bundle
 *
 * Edge cases handled:
 *   - Both \r\n (Windows) and \n (Unix) line endings
 *   - UTF-8 BOM at start of file (Google sometimes prepends it)
 *   - Quoted fields containing commas: `"foo, bar",baz` -> ["foo, bar", "baz"]
 *   - Escaped quotes inside quoted fields: `"he said ""hi"""` -> `he said "hi"`
 *   - Numbers with thousand separators ("47,398") via parseNumeric helper
 *   - Empty cells (return as empty string)
 */

/**
 * Result of a sheet fetch. Discriminated union so callers handle both states.
 * Failure modes: network blip, sheet unpublished, URL changed, parse error.
 */
export type SheetFetchResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: string };

/**
 * Fetch a published Google Sheet CSV and parse it into rows of objects keyed
 * by the header row. Caches at the Next.js layer for the given seconds.
 *
 * Server-side only — relies on Next.js's extended fetch with revalidate.
 *
 * @param url   The published-to-web CSV URL from Google Sheets
 * @param revalidateSeconds  Cache TTL. Default 300 (5min) matches Google's own cache.
 */
export async function fetchSheetAsObjects<T extends Record<string, string>>(
  url: string,
  revalidateSeconds = 300,
): Promise<SheetFetchResult<T>> {
  try {
    const res = await fetch(url, {
      // Next.js extended fetch — caches the response for revalidateSeconds at the
      // edge. Subsequent requests within that window don't hit Google.
      next: { revalidate: revalidateSeconds },
      // Help Google's CDN serve us a cached version.
      headers: { Accept: "text/csv" },
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Sheet fetch failed: HTTP ${res.status} ${res.statusText}`,
      };
    }

    const text = await res.text();
    const rows = parseCsvToObjects<T>(text);

    if (rows.length === 0) {
      // Could mean the sheet is empty, or the parser found no data rows after
      // the header. Either way the table will be empty — surface as a soft error
      // so the page can show its empty state.
      return { ok: false, error: "Sheet returned no data rows." };
    }

    return { ok: true, rows };
  } catch (err) {
    // Network errors, DNS failures, timeouts.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown fetch error",
    };
  }
}

/**
 * Parse a CSV string into an array of objects keyed by the header row.
 *
 * The header row is treated as the source of truth for object keys — order
 * of columns in the sheet doesn't matter at the call site, only the names.
 */
export function parseCsvToObjects<T extends Record<string, string>>(
  csv: string,
): T[] {
  // Strip UTF-8 BOM if present (Google sometimes includes it).
  const cleaned = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;

  const lines = parseCsvLines(cleaned);
  if (lines.length < 2) return [];

  const headers = lines[0];
  const dataLines = lines.slice(1);

  return dataLines
    .filter((row) => row.some((cell) => cell.trim() !== "")) // drop fully-empty rows
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = (row[i] ?? "").trim();
      });
      return obj as T;
    });
}

/**
 * Parse a CSV string into a 2D array of cells, respecting quoted fields and
 * escaped quotes. Handles \r\n and \n line endings.
 */
function parseCsvLines(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < csv.length) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        // Lookahead: is this an escaped quote ("") or end of quoted field?
        if (csv[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      // Any other char inside quotes — including commas and newlines — is literal
      currentField += char;
      i++;
      continue;
    }

    // Not in quotes
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
      i++;
      continue;
    }
    if (char === "\r") {
      // Treat \r alone as nothing; \r\n handled by the \n case below
      i++;
      continue;
    }
    if (char === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      i++;
      continue;
    }
    currentField += char;
    i++;
  }

  // Push the last field/row if the file didn't end with a newline
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parse a string that may contain numeric data with thousand separators
 * (e.g. "47,398") or a stray currency symbol. Returns NaN if not parseable
 * (caller should provide a fallback — typically 0).
 */
export function parseNumeric(value: string | undefined): number {
  if (!value) return NaN;
  // Strip everything that isn't a digit, decimal point, or minus sign
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse a numeric column with a default fallback (typically 0 for sortable
 * values that should sink to the bottom).
 */
export function parseNumericOr(value: string | undefined, fallback: number): number {
  const n = parseNumeric(value);
  return Number.isNaN(n) ? fallback : n;
}
