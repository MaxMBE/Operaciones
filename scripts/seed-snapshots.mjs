/**
 * Script: seed-snapshots.mjs
 * Crea snapshots históricos en portfolio_snapshots usando la data actual de cor_settings.
 * Semanas: 2026-03-03 y 2026-03-10 (ambas con la misma data)
 * Uso: node scripts/seed-snapshots.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Leer .env.local
const envFile = readFileSync(join(ROOT, ".env.local"), "utf8");
const env = {};
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
}

const supabase = createClient(env["NEXT_PUBLIC_SUPABASE_URL"], env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

// 1. Leer data actual desde cor_settings
console.log("📖  Leyendo data actual de cor_settings...");
const { data: rows, error: readError } = await supabase
  .from("cor_settings")
  .select("key, value")
  .in("key", ["ph_csv_data", "ph_report_data"]);

if (readError || !rows?.length) {
  console.error("❌  Error leyendo cor_settings:", readError?.message ?? "sin datos");
  process.exit(1);
}

const store = Object.fromEntries(rows.map(r => [r.key, r.value]));
const projects   = store["ph_csv_data"]?.projects ?? [];
const reportData = store["ph_report_data"] ?? {};

console.log(`   ${projects.length} proyectos, ${Object.keys(reportData).length} reports`);

// 2. Definir los dos snapshots
const snapshots = [
  {
    snapshot_date: "2026-03-03",
    week_label:    "Semana del 3 de marzo de 2026",
  },
  {
    snapshot_date: "2026-03-10",
    week_label:    "Semana del 10 de marzo de 2026",
  },
];

// 3. Insertar/actualizar en portfolio_snapshots
for (const snap of snapshots) {
  console.log(`\n📅  Creando snapshot: ${snap.week_label}...`);
  const { error } = await supabase
    .from("portfolio_snapshots")
    .upsert(
      {
        snapshot_date: snap.snapshot_date,
        week_label:    snap.week_label,
        projects,
        report_data:   reportData,
        cor_manual:    null,
      },
      { onConflict: "snapshot_date" }
    );

  if (error) {
    console.error(`❌  Error:`, error.message);
  } else {
    console.log(`✓   Snapshot "${snap.week_label}" guardado`);
  }
}

console.log("\n✅  Snapshots creados. La data actual en cor_settings sigue siendo editable (semana del 10 de marzo).");
