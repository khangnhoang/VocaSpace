// app/api/cron/expire-payments/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { message: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { message: "Unauthorized cron request." },
      { status: 401 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("expire_stale_payments", {
    p_limit: 100,
  });

  if (error) {
    console.error("🚨 [EXPIRE_PAYMENTS_CRON_FAILED]:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Expire stale payments failed.",
        error: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    expiredCount: data ?? 0,
  });
}