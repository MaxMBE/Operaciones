import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET /api/snapshots — lista de snapshots (sin el payload completo)
export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("id, snapshot_date, week_label, created_at")
    .order("snapshot_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/snapshots — crear snapshot
export async function POST(req: Request) {
  const supabase = getSupabase();
  try {
    const body = await req.json();
    const { snapshot_date, week_label, projects, report_data, cor_manual } = body;

    if (!snapshot_date || !week_label || !projects) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Upsert: si ya existe snapshot para esa fecha, lo actualiza
    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .upsert({ snapshot_date, week_label, projects, report_data: report_data ?? {}, cor_manual: cor_manual ?? null }, { onConflict: "snapshot_date" })
      .select("id, snapshot_date, week_label, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Error al crear snapshot" }, { status: 500 });
  }
}
