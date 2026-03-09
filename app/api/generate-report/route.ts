import Anthropic from "@anthropic-ai/sdk";
import type { ProjectReport } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      project: {
        name: string;
        client?: string;
        serviceType?: string;
        serviceLevel?: string;
        manager?: string;
        leader?: string;
        startDate?: string;
        endDate?: string;
        progress?: number;
        status?: string;
        csvRisks?: string;
        csvMitigation?: string;
        csvNextActions?: string;
        csvHistoricalComments?: string;
        csvOtdPercent?: string;
        csvOqdPercent?: string;
        shortComment?: string;
      };
      isFixedPrice: boolean;
    };

    const { project, isFixedPrice } = body;

    const fpFields = `{
  "projectScope": "Alcance del proyecto (2-3 bullets con formato • item)",
  "projectCurrentStatus": "Estado actual (2-3 bullets con formato • item)",
  "keyRisks": "Riesgos e issues clave (2-3 bullets con formato • item)",
  "achievements": "Logros principales (2-3 bullets con formato • item)",
  "nextSteps": "Próximos pasos (2-3 bullets con formato • item)",
  "focus": "Foco / CSF (2-3 bullets con formato • item)",
  "phase": "Fase actual en texto corto",
  "statusNote": "Nota ejecutiva del estado en 1-2 oraciones",
  "overallStatus": "G, A, R o grey",
  "currentStatus": "G, A, R o grey",
  "previousStatus": "G, A, R o grey",
  "actualProgress": "${project.progress ?? 0}%",
  "plannedProgress": "xx%",
  "otd": "G, A, R o grey",
  "oqd": "${project.csvOqdPercent || "TBC"}"
}`;

    const ccFields = `{
  "currentIssues": "Issues activos (2-3 bullets con formato • item)",
  "actionsInProgress": "Acciones en curso (2-3 bullets con formato • item)",
  "healthDelivery": "Estado delivery cadence (1-2 bullets con formato • item)",
  "healthGovernance": "Estado governance (1-2 bullets con formato • item)",
  "healthTeam": "Estado team stability (1-2 bullets con formato • item)",
  "scopeService": "Descripción del alcance (2-3 bullets con formato • item)",
  "scopeType": "Recurrente / T&M / Retainer",
  "achievements": "Logros relevantes (2-3 bullets con formato • item)",
  "valueToClient": "Valor al cliente (2-3 bullets con formato • item)",
  "keyRisks": "Riesgos identificados (2-3 bullets con formato • item)",
  "mitigation": "Plan de mitigación (2-3 bullets con formato • item)",
  "nextSteps": "Próximos pasos (2-3 bullets con formato • item)",
  "focus": "Foco / CSF (2-3 bullets con formato • item)",
  "statusNote": "Nota ejecutiva del estado en 2-3 oraciones",
  "phase": "Fase actual en texto corto",
  "overallStatus": "G, A, R o grey",
  "currentStatus": "G, A, R o grey",
  "previousStatus": "G, A, R o grey",
  "milestonesStatus": "G, A, R o grey",
  "resourcesStatus": "G, A, R o grey",
  "issuesStatus": "G, A, R o grey",
  "risksStatus": "G, A, R o grey"
}`;

    const prompt = `Eres un PM experto en servicios IT. Genera un reporte de estado profesional basado en los siguientes datos reales del proyecto.

DATOS DEL PROYECTO:
- Nombre: ${project.name}
- Cliente: ${project.client || "No especificado"}
- Tipo de Servicio: ${project.serviceType || "No especificado"}
- Nivel de Servicio: ${project.serviceLevel || "No especificado"}
- Business Manager: ${project.manager || "No especificado"}
- Team Lead: ${project.leader || "No especificado"}
- Fechas: ${project.startDate || "?"} → ${project.endDate || "?"}
- Progreso Real: ${project.progress ?? 0}%
- Estado: ${project.status || "active"}
- Comentario: ${project.shortComment || "—"}
- Riesgos CSV: ${project.csvRisks || "—"}
- Mitigación CSV: ${project.csvMitigation || "—"}
- Próximas Acciones CSV: ${project.csvNextActions || "—"}
- Historial: ${project.csvHistoricalComments || "—"}
- % OTD: ${project.csvOtdPercent || "—"}
- % OQD: ${project.csvOqdPercent || "—"}

Tipo de reporte: ${isFixedPrice ? "Fixed Price" : "CC/SC (Competence Center / Service Center)"}

INSTRUCCIONES:
- Basa tu respuesta en los datos reales del proyecto.
- Para campos con múltiples puntos, usa EXACTAMENTE este formato: "• Punto 1\n• Punto 2\n• Punto 3"
- Para estados (overallStatus, currentStatus, etc.): usa "G" (verde/bien), "A" (ámbar/riesgo), "R" (rojo/problema) o "grey" (sin datos).
- Sé conciso y profesional. Escribe en español.
- Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto extra.

Formato de respuesta:
${isFixedPrice ? fpFields : ccFields}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: Partial<ProjectReport>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "El modelo devolvió una respuesta inesperada.", raw }, { status: 500 });
    }

    return Response.json({ report: parsed });

  } catch (err) {
    console.error("generate-report error:", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
