export async function upsertRow(supabase, table, row, onConflict = "id") {
  const { error } = await supabase.from(table).upsert(row, { onConflict });

  if (error) {
    throw new Error(`Cannot prepare fixture ${table}: ${error.message}`);
  }
}
