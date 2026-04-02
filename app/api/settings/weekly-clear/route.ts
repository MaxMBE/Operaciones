import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const SETTINGS_KEY = "weekly_clear_date";

// GET — returns the last Monday the weekly clear was performed (ISO date string)
export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("cor_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) return NextResponse.json(null, { status: 500 });
  return NextResponse.json(data?.value ?? null);
}

// POST — saves the Monday date of the current clear
export async function POST(req: Request) {
  const supabase = getSupabase();
  try {
    const value = await req.json();
    const { error } = await supabase
      .from("cor_settings")
      .upsert({ key: SETTINGS_KEY, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
