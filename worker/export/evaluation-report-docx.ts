import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

export type EvaluationIndicatorReportRow = {
  no: number;
  indicator: string;
  value: number | null;
};

type EvaluationIndicatorReport = {
  title: string;
  rows: EvaluationIndicatorReportRow[];
};

const FONT = "Arial";
const FONT_SIZE = 22;
const TABLE_WIDTH = 6712;
const COLUMN_WIDTHS = [603, 4945, 1164] as const;
const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
} as const;

function reportCell(text: string, column: 0 | 1 | 2, options: { bold?: boolean } = {}) {
  const alignment = column === 1 ? AlignmentType.LEFT : AlignmentType.CENTER;
  return new TableCell({
    width: { size: COLUMN_WIDTHS[column], type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [new Paragraph({ alignment, spacing: { before: 0, after: 0, line: 276 }, children: [new TextRun({ text, bold: options.bold, font: FONT, size: FONT_SIZE, color: "000000" })] })],
  });
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value.toFixed(2).replace(".", ",")}%`;
}

export async function createEvaluationIndicatorReportDocx(input: EvaluationIndicatorReport) {
  const header = new TableRow({ tableHeader: true, cantSplit: true, children: [reportCell("No.", 0, { bold: true }), reportCell("Indikator Penilaian", 1, { bold: true }), reportCell("Nilai", 2, { bold: true })] });
  const rows = input.rows.map((row) => new TableRow({ cantSplit: true, children: [reportCell(String(row.no), 0), reportCell(row.indicator, 1), reportCell(formatPercent(row.value), 2)] }));
  const document = new Document({
    styles: { default: { document: { run: { font: FONT, size: FONT_SIZE, color: "000000" }, paragraph: { spacing: { before: 0, after: 0, line: 276 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 180, line: 288 }, keepNext: true, children: [new TextRun({ text: input.title, bold: true, font: FONT, size: 24, color: "000000" })] }), new Table({ alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: [...COLUMN_WIDTHS], borders, rows: [header, ...rows] })] }],
  });
  return Packer.toBlob(document);
}
