import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const KEYS = ["ph_csv_data", "ph_finance_data", "ph_report_data", "ph_oportunidades", "ph_known_people"] as const;

async function getStore(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("cor_settings")
    .select("key, value")
    .in("key", KEYS);

  if (error || !data) return {};

  return Object.fromEntries(data.map(row => [row.key, row.value]));
}

async function saveStore(store: Record<string, unknown>) {
  const rows = Object.entries(store)
    .filter(([key]) => (KEYS as readonly string[]).includes(key))
    .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));

  if (rows.length === 0) return;

  await supabase
    .from("cor_settings")
    .upsert(rows, { onConflict: "key" });
}

export async function GET() {
  const store = await getStore();
  return NextResponse.json(store);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await saveStore(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save" }, { status: 500 });
  }
}
