import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, HeadingLevel, BorderStyle,
  Header, ImageRun, ShadingType,
} from "docx";
import { saveAs } from "file-saver";

export type CarmoTabId = "carmo" | "pricing" | "escenarios";

export interface CarmoExportRow {
  label: string;
  value: string;
  bold?: boolean;
}

export interface CarmoExportTable {
  headers: string[];
  rows: string[][];
}

export interface CarmoExportSection {
  title: string;
  rows?: CarmoExportRow[];
  table?: CarmoExportTable;
  badge?: { label: string; color: string }; // color: "green"|"amber"|"red"|"black"
}

export interface CarmoExportData {
  tab: CarmoTabId;
  tabLabel: string;
  titulo?: string;   // e.g. project name
  fecha: string;
  sections: CarmoExportSection[];
}

// ─── COLORES SII GROUP ─────────────────────────────────────────────────────────
const INDIGO  = "4F46E5";
const DARK    = "111827";
const GRAY    = "6B7280";
const LIGHT   = "F3F4F6";
const WHITE   = "FFFFFF";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function borderNone() {
  return { style: BorderStyle.NONE, size: 0, color: WHITE };
}

function cellBorders() {
  return {
    top:    { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    left:   { style: BorderStyle.NONE, size: 0, color: WHITE },
    right:  { style: BorderStyle.NONE, size: 0, color: WHITE },
  };
}

function headerCellBorders() {
  return {
    top:    { style: BorderStyle.SINGLE, size: 4, color: INDIGO },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: INDIGO },
    left:   { style: BorderStyle.NONE, size: 0, color: WHITE },
    right:  { style: BorderStyle.NONE, size: 0, color: WHITE },
  };
}

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; italic?: boolean } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    children: [new TextRun({
      text,
      bold: opts.bold ?? false,
      italics: opts.italic ?? false,
      size: opts.size ?? 20,          // half-points (20 = 10pt)
      color: opts.color ?? DARK,
    })],
  });
}

function sectionTitle(title: string) {
  return new Paragraph({
    spacing: { before: 240, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: INDIGO } },
    children: [new TextRun({
      text: title.toUpperCase(),
      bold: true,
      size: 18,
      color: INDIGO,
      allCaps: true,
    })],
  });
}

function kv(label: string, value: string, bold = false) {
  return new TableRow({
    children: [
      new TableCell({
        borders: cellBorders(),
        width: { size: 45, type: WidthType.PERCENTAGE },
        shading: { fill: LIGHT, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: label, size: 20, color: GRAY })] })],
      }),
      new TableCell({
        borders: cellBorders(),
        width: { size: 55, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, bold, color: DARK })] })],
      }),
    ],
  });
}

function kvTable(rows: CarmoExportRow[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: borderNone(), bottom: borderNone(), left: borderNone(), right: borderNone() },
    rows: rows.map(r => kv(r.label, r.value, r.bold)),
  });
}

function dataTable(t: CarmoExportTable) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: t.headers.map(h =>
      new TableCell({
        shading: { fill: INDIGO, type: ShadingType.CLEAR },
        borders: headerCellBorders(),
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: WHITE, size: 18 })] })],
      })
    ),
  });
  const dataRows = t.rows.map((row, i) =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          shading: { fill: i % 2 === 0 ? WHITE : LIGHT, type: ShadingType.CLEAR },
          borders: cellBorders(),
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18, color: DARK })] })],
        })
      ),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ─── EXPORT WORD ──────────────────────────────────────────────────────────────
export async function exportCarmoWord(data: CarmoExportData) {
  const body: (Paragraph | Table)[] = [];

  // ── Header area ──
  body.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "SII GROUP CHILE  ·  OPERACIONES", bold: true, size: 20, color: INDIGO }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: INDIGO } },
      children: [
        new TextRun({ text: "CaRMO – Calculadora de Rentabilidad", bold: true, size: 40, color: DARK }),
      ],
    }),
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: `${data.tabLabel}`, bold: true, size: 24, color: INDIGO })] }),
  );

  if (data.titulo) {
    body.push(new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: data.titulo, size: 22, color: DARK })] }));
  }

  body.push(
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `Fecha: ${data.fecha}`, size: 18, color: GRAY, italics: true })] }),
  );

  // ── Sections ──
  for (const sec of data.sections) {
    body.push(sectionTitle(sec.title));

    if (sec.badge) {
      const badgeColor = sec.badge.color === "green" ? "166534" : sec.badge.color === "amber" ? "92400E" : sec.badge.color === "red" ? "991B1B" : "111827";
      const bgColor    = sec.badge.color === "green" ? "DCFCE7" : sec.badge.color === "amber" ? "FEF3C7" : sec.badge.color === "red" ? "FEE2E2" : "F3F4F6";
      body.push(
        new Paragraph({
          spacing: { before: 80, after: 120 },
          shading: { fill: bgColor, type: ShadingType.CLEAR },
          children: [
            new TextRun({ text: `  ${sec.badge.label}  `, bold: true, size: 22, color: badgeColor }),
          ],
        })
      );
    }

    if (sec.rows && sec.rows.length > 0) {
      body.push(kvTable(sec.rows));
      body.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }

    if (sec.table) {
      body.push(dataTable(sec.table));
      body.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }

  // ── Footer ──
  body.push(
    new Paragraph({
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" } },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Documento confidencial · SII Group Chile · ${data.fecha}`, size: 16, color: GRAY, italics: true }),
      ],
    })
  );

  const doc = new Document({
    creator: "SII Group Chile",
    title: `CaRMO – ${data.tabLabel}`,
    description: "Calculadora de Rentabilidad SII Group",
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 900, bottom: 720, left: 900 },
        },
      },
      children: body,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `CaRMO_${data.tabLabel.replace(/\s+/g, "_")}_${data.fecha.replace(/\s/g, "_")}.docx`;
  saveAs(blob, filename);
}
