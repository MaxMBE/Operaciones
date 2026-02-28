import Anthropic from "@anthropic-ai/sdk";
import type { Oportunidad } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface OportunidadProposal {
  id: string | null;          // matched existing id, or null if new
  numero: number | null;
  titulo: string;
  cliente: string;
  probabilidad: number | null;
  estadoProtec: string;
  encargado: string;
  businessManager: string;
  razon: string;              // explanation of what changed / why
  isNew: boolean;             // true if not matched to an existing oportunidad
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      imageBase64: string;
      mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      oportunidades: Oportunidad[];
    };

    const { imageBase64, mediaType, oportunidades } = body;

    if (!imageBase64) {
      return Response.json({ error: "Imagen requerida." }, { status: 400 });
    }

    const currentData = JSON.stringify(oportunidades, null, 2);

    const prompt = `Eres un asistente que analiza imágenes de tablas o listas de oportunidades comerciales.

Se te proporciona:
1. Una imagen que puede contener una tabla, captura de pantalla o listado de oportunidades comerciales.
2. El estado actual de las oportunidades en el sistema (JSON).

Tu tarea es analizar la imagen e identificar qué oportunidades deberían ser actualizadas o creadas basándote en la información visible en la imagen.

ESTADO ACTUAL DEL SISTEMA:
${currentData}

INSTRUCCIONES:
- Compara la información de la imagen con el estado actual.
- Para cada oportunidad encontrada en la imagen, determina si coincide con alguna existente (por número, título o cliente).
- Propón actualizaciones solo para campos que claramente difieran o que estén presentes en la imagen.
- Si la imagen muestra una oportunidad que no existe en el sistema, márcala como nueva (isNew: true).
- Si un campo no está visible en la imagen, mantén el valor actual o deja vacío.
- Explica brevemente en "razon" qué cambios detectaste y por qué.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra) con este formato:
{
  "proposals": [
    {
      "id": "id_existente_o_null",
      "numero": 123,
      "titulo": "Nombre del proyecto",
      "cliente": "Nombre del cliente",
      "probabilidad": 75,
      "estadoProtec": "En progreso",
      "encargado": "Nombre del encargado",
      "businessManager": "Nombre del BM",
      "razon": "Descripción del cambio detectado",
      "isNew": false
    }
  ]
}

Si no encuentras ninguna información relevante de oportunidades en la imagen, responde:
{"proposals": []}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: prompt },
        ],
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: { proposals: OportunidadProposal[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "El modelo devolvió una respuesta inesperada.", raw }, { status: 500 });
    }

    // Match proposals to existing oportunidades if id is missing
    const proposals = (parsed.proposals ?? []).map(p => {
      if (p.id) return p;
      const match = oportunidades.find(o =>
        (p.numero && o.numero === p.numero) ||
        (p.titulo && o.titulo.toLowerCase() === p.titulo.toLowerCase()) ||
        (p.cliente && o.cliente.toLowerCase() === p.cliente.toLowerCase())
      );
      return { ...p, id: match?.id ?? null, isNew: !match };
    });

    return Response.json({ proposals });

  } catch (err) {
    console.error("analyze-oportunidades-image error:", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
