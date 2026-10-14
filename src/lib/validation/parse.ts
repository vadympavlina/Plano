import type { z } from 'zod';

/**
 * Parses a Firebase collection snapshot (`{ [id]: record }`) into a typed map.
 * Records that fail validation are skipped (and reported) instead of crashing
 * the whole UI.
 */
export function parseCollection<T>(
  raw: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  onInvalid?: (id: string, error: z.ZodError) => void,
): Record<string, T> {
  const result: Record<string, T> = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const parsed = schema.safeParse({ ...(value as object), id });
    if (parsed.success) result[id] = parsed.data;
    else onInvalid?.(id, parsed.error);
  }
  return result;
}

/** Removes `undefined` values recursively — Firebase rejects them. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map((v) => stripUndefined(v)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}
