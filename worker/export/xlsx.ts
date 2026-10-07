import { strToU8, zipSync } from "fflate";
import { isoDateToExcelSerial } from "../domain/dates/date-format";

export type WorkbookSheet = {
  name: string;
  rows: Array<Array<string | number | null>>;
  textColumns?: number[];
  dateColumns?: number[];
  percentageColumns?: number[];
  hiddenColumns?: number[];
  columnWidths?: number[];
  autoFilter?: boolean;
  headerRows?: number[];
  tableStartRow?: number;
  tableEndRow?: number;
  charts?: Array<{
    type: "bar";
    title: string;
    categoryColumn: number;
    valueColumn: number;
    startRow: number;
    endRow: number;
    from: { row: number; col: number };
    to: { row: number; col: number };
    percentage?: boolean;
    axisMin?: number;
    axisMax?: number;
    majorUnit?: number;
    axisTitle?: string;
    dataLabelFormat?: string;
    caption?: string;
  }>;
};

function escapeXml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function columnName(index: number) {
  let result = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function sheetXml(sheet: WorkbookSheet, hasDrawing: boolean) {
  const { rows } = sheet;
  const maxColumnCount = Math.max(1, ...rows.map((row) => row.length));
  const endReference = `${columnName(maxColumnCount - 1)}${Math.max(1, rows.length)}`;
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      const header = rowIndex === 0 || sheet.headerRows?.includes(rowIndex);
      const bordered = sheet.tableStartRow !== undefined && sheet.tableEndRow !== undefined && rowIndex >= sheet.tableStartRow && rowIndex <= sheet.tableEndRow;
      const styleId = header && bordered ? 7 : header ? 1 : bordered && sheet.percentageColumns?.includes(columnIndex) ? 6 : bordered ? 5 : sheet.textColumns?.includes(columnIndex) ? 2 : sheet.dateColumns?.includes(columnIndex) ? 3 : sheet.percentageColumns?.includes(columnIndex) ? 4 : 0;
      const style = styleId ? ` s="${styleId}"` : "";
      if (sheet.dateColumns?.includes(columnIndex) && typeof value === "string") {
        const serial = isoDateToExcelSerial(value);
        if (serial !== null) return `<c r="${reference}"${style}><v>${serial}</v></c>`;
      }
      if (typeof value === "number") return `<c r="${reference}"${style}><v>${value}</v></c>`;
      return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const explicitColumnCount = Math.max(sheet.columnWidths?.length ?? 0, maxColumnCount);
  const columns = explicitColumnCount > 0
    ? Array.from({ length: explicitColumnCount }, (_, index) => {
        const width = sheet.columnWidths?.[index] ?? 20;
        const hidden = sheet.hiddenColumns?.includes(index) ? ' hidden="1"' : "";
        return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"${hidden}${sheet.textColumns?.includes(index) ? ' style="2"' : ""}/>`;
      }).join("")
    : '<col min="1" max="30" width="20" customWidth="1"/>';
  const autoFilter = sheet.autoFilter === false ? "" : `<autoFilter ref="A1:${endReference}"/>`;
  const drawing = hasDrawing ? '<drawing r:id="rId1"/>' : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${endReference}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${body}</sheetData>${autoFilter}${drawing}</worksheet>`;
}

function sheetFormulaName(name: string) {
  return `'${name.replaceAll("'", "''")}'`;
}

function chartXml(sheet: WorkbookSheet, chart: NonNullable<WorkbookSheet["charts"]>[number]) {
  const sheetName = sheetFormulaName(sheet.name);
  const category = `${sheetName}!$${columnName(chart.categoryColumn)}$${chart.startRow + 1}:$${columnName(chart.categoryColumn)}$${chart.endRow + 1}`;
  const values = `${sheetName}!$${columnName(chart.valueColumn)}$${chart.startRow + 1}:$${columnName(chart.valueColumn)}$${chart.endRow + 1}`;
  const format = chart.percentage ? "0.00%" : "0.00";
  const labelFormat = chart.dataLabelFormat ?? format;
  const axisMin = chart.axisMin ?? (chart.percentage ? 0 : undefined);
  const axisMax = chart.axisMax ?? (chart.percentage ? 1 : undefined);
  const scaling = `<c:scaling><c:orientation val="minMax"/>${axisMax === undefined ? "" : `<c:max val="${axisMax}"/>`}${axisMin === undefined ? "" : `<c:min val="${axisMin}"/>`}</c:scaling>`;
  const majorUnit = chart.majorUnit === undefined ? "" : `<c:majorUnit val="${chart.majorUnit}"/>`;
  const axisTitle = chart.axisTitle ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="id-ID" sz="900"/><a:t>${escapeXml(chart.axisTitle)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:style val="10"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="id-ID" sz="1100"/><a:t>${escapeXml(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Nilai (%)</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="1F77B4"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:cat><c:strRef><c:f>${escapeXml(category)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${escapeXml(values)}</c:f></c:numRef></c:val><c:dLbls><c:numFmt formatCode="${escapeXml(labelFormat)}" sourceLinked="0"/><c:dLblPos val="outEnd"/><c:showVal val="1"/><c:showLegendKey val="0"/><c:showCatName val="0"/><c:showSerName val="0"/></c:dLbls></c:ser><c:gapWidth val="35"/><c:axId val="48650112"/><c:axId val="48672768"/></c:barChart><c:catAx><c:axId val="48650112"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:tickLblPos val="nextTo"/><c:crossAx val="48672768"/><c:crosses val="min"/><c:auto val="1"/><c:lblAlgn val="ctr"/></c:catAx><c:valAx><c:axId val="48672768"/>${scaling}<c:delete val="0"/><c:axPos val="b"/>${axisTitle}<c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/>${majorUnit}<c:crossAx val="48650112"/><c:crosses val="min"/><c:crossBetween val="between"/></c:valAx><c:spPr><a:noFill/><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></c:spPr></c:plotArea><c:legend><c:legendPos val="b"/><c:delete val="1"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="1"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function drawingXml(chart: NonNullable<WorkbookSheet["charts"]>[number]) {
  const caption = chart.caption ? `<xdr:twoCellAnchor><xdr:from><xdr:col>${chart.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${chart.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.to.row + 2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:sp><xdr:nvSpPr><xdr:cNvPr id="3" name="Caption 1"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr><xdr:spPr><a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></xdr:spPr><xdr:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="id-ID" sz="1200"/><a:t>${escapeXml(chart.caption)}</a:t></a:r></a:p></xdr:txBody></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor><xdr:from><xdr:col>${chart.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${chart.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>${caption}</xdr:wsDr>`;
}

export function createXlsx(sheets: WorkbookSheet[]): Uint8Array {
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  let chartNumber = 0;
  const drawingOverrides = sheets.flatMap((sheet, sheetIndex) => (sheet.charts ?? []).slice(0, 1).map(() => {
    chartNumber += 1;
    return `<Override PartName="/xl/drawings/drawing${sheetIndex + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart${chartNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
  })).join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}${drawingOverrides}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E5A8A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7E3EC"/></left><right style="thin"><color rgb="FFD7E3EC"/></right><top style="thin"><color rgb="FFD7E3EC"/></top><bottom style="thin"><color rgb="FFD7E3EC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
  };
  chartNumber = 0;
  sheets.forEach((sheet, index) => {
    const chart = sheet.charts?.[0];
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet, Boolean(chart)));
    if (chart) {
      chartNumber += 1;
      files[`xl/worksheets/_rels/sheet${index + 1}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${index + 1}.xml"/></Relationships>`);
      files[`xl/drawings/drawing${index + 1}.xml`] = strToU8(drawingXml(chart));
      files[`xl/drawings/_rels/drawing${index + 1}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNumber}.xml"/></Relationships>`);
      files[`xl/charts/chart${chartNumber}.xml`] = strToU8(chartXml(sheet, chart));
    }
  });
  return zipSync(files, { level: 6 });
}
