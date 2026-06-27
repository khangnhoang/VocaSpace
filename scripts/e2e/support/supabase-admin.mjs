import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin(env = process.env) {
  return createClient(
    requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export function requiredEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
