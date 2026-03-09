import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR  = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "store.json");

function getStore(): Record<string, unknown> {
  try {
    if (!existsSync(DATA_FILE)) return {};
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveStore(data: Record<string, unknown>) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(getStore());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    saveStore(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save" }, { status: 500 });
  }
}
