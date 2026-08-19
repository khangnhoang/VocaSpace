const SUPABASE_PAGE_SIZE = 500;
const SUPABASE_ID_CHUNK_SIZE = 100;

type SupabasePage<T> = {
  data: T[] | null;
  error: unknown;
};

export type SupabaseRowsResult<T> =
  | { data: T[]; error: null }
  | { data: null; error: unknown };

export async function readAllSupabaseRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
): Promise<SupabaseRowsResult<T>> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const page = await loadPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (page.error !== null) return { data: null, error: page.error };

    const pageRows = page.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
}

export async function readChunkedSupabaseRows<T>(
  ids: string[],
  loadPage: (
    chunkIds: string[],
    from: number,
    to: number,
  ) => PromiseLike<SupabasePage<T>>,
): Promise<SupabaseRowsResult<T>> {
  const rows: T[] = [];

  for (let index = 0; index < ids.length; index += SUPABASE_ID_CHUNK_SIZE) {
    const chunkIds = ids.slice(index, index + SUPABASE_ID_CHUNK_SIZE);
    const chunk = await readAllSupabaseRows((from, to) =>
      loadPage(chunkIds, from, to),
    );
    if (chunk.data === null) return chunk;
    rows.push(...chunk.data);
  }

  return { data: rows, error: null };
}
