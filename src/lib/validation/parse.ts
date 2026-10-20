import type { z } from 'zod';

/** What the last parse of a collection produced, to reuse unchanged records. */
export interface ParseMemo<T> {
  json: Map<string, string>;
  result: Record<string, T>;
}

/**
 * Validates a Firebase collection, skipping invalid records. Records whose raw value
 * didn't change keep their previous object (and the previous map is returned when
 * nothing changed): no re-validation, and memoised views can skip unchanged items.
 */
export function parseCollectionShared<T>(
  raw: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  memo: ParseMemo<T> | undefined,
  onInvalid?: (id: string, error: z.ZodError) => void,
): ParseMemo<T> {
  const json = new Map<string, string>();
  const result: Record<string, T> = {};
  let same = !!memo;
  if (raw && typeof raw === 'object') {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const j = JSON.stringify(value);
      json.set(id, j);
      if (memo && memo.json.get(id) === j && id in memo.result) {
        result[id] = memo.result[id];
        continue;
      }
      same = false;
      const parsed = schema.safeParse({ ...(value as object), id });
      if (parsed.success) result[id] = parsed.data;
      else onInvalid?.(id, parsed.error);
    }
  }
  if (same && memo && json.size === memo.json.size && Object.keys(result).length === Object.keys(memo.result).length) return memo;
  return { json, result };
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
