/**
 * Script: upload-to-supabase.mjs
 * Sube el contenido de data/store.json a Supabase (tabla cor_settings)
 * Uso: node scripts/upload-to-supabase.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Leer .env.local manualmente
const envFile = readFileSync(join(ROOT, ".env.local"), "utf8");
const env = {};
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
}

const SUPABASE_URL  = env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_KEY  = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Leer store.json
const storePath = join(ROOT, "data", "store.json");
const store = JSON.parse(readFileSync(storePath, "utf8"));

const keys = Object.keys(store);
console.log(`📦  Uploading ${keys.length} keys: ${keys.join(", ")}`);

let errors = 0;
for (const key of keys) {
  const value = store[key];
  const { error } = await supabase
    .from("cor_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    console.error(`❌  Error subiendo "${key}":`, error.message);
    errors++;
  } else {
    console.log(`✓  "${key}" subido correctamente`);
  }
}

if (errors === 0) {
  console.log("\n✅  Todos los datos subidos a Supabase correctamente.");
} else {
  console.log(`\n⚠️   ${errors} errores al subir datos.`);
  process.exit(1);
}
