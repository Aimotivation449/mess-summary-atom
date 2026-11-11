import { LEDGER_KEYS, SECTION_LABELS, batchAmount, batchQuantity, calculate, fixed, monthLabel, summaryBlocks, weightedRate } from "./messWorksheet";

const encoder = new TextEncoder();
const xml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[c]));
const column = n => {
  let out = '';
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out;
  return out;
};
const column = n => {
  let out = '';
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out;
  return out;
};
function themeColor(key, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1).toUpperCase() : fallback;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  const header = size => {
    const bytes = new Uint8Array(size);
    return { bytes, view: new DataView(bytes.buffer) };
  };
  files.forEach(([path, content]) => {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    chunks.push(local.bytes, name, data);
    const central = header(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint32(16, crc, true);
    central.view.setUint32(20, data.length, true);
    central.view.setUint32(24, data.length, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint32(42, offset, true);
    directory.push(central.bytes, name);
    offset += 30 + name.length + data.length;
  });
  const directorySize = directory.reduce((sum, b) => sum + b.length, 0);
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, directorySize, true);
  end.view.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end.bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function makeSheet(rows, merges = [], widths = []) {
  const data = rows.map((row, index) => {
    const cells = row.map((value, col) => {
      if (value === null || value === undefined) return '';
      const descriptor = typeof value === 'object' ? value : { value_c: value };
      const v = descriptor.value_c;
      const style = descriptor.style_c ?? (typeof v === 'number' ? 2 : 0);
      const reference = `${column(col)}${index + 1}`;
      return typeof v === 'number'
        ? `<c r="${reference}" s="${style}"><v>${Number.isFinite(v) ? v : 0}</v></c>`
        : `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${index + 1}" ht="20" customHeight="1">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${data}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.map(r => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/>
<pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}
const heading = value => ({ value_c: value, style_c: 1 });
const totalCell = value => ({ value_c: value, style_c: typeof value === 'number' ? 3 : 4 });

function appendPairs(rows, merges, blocks, left = 0, right = 9) {
  for (let i = 0; i < blocks.length; i += 2) {
    rows.push([]);
    const a = blocks[i];
    const b = blocks[i + 1];
    const header = [];
    header[left] = heading(a.title_c);
    if (b) header[right] = heading(b.title_c);
    rows.push(header);
    const r = rows.length;
    merges.push(`${column(left)}${r}:${column(left + 7)}${r}`);
    if (b) merges.push(`${column(right)}${r}:${column(right + 7)}${r}`);
    const length = Math.max(a.rows_c.length, b?.rows_c.length ?? 0);
    for (let j = 0; j < length; j++) {
      const row = [];
      [a, b].forEach((block, side) => {
        if (!block?.rows_c[j]) return;
        const start = side ? right : left;
        row[start] = block.rows_c[j][0];
        row[start + 7] = block.rows_c[j][1];
        merges.push(`${column(start)}${rows.length + 1}:${column(start + 6)}${rows.length + 1}`);
      });
      rows.push(row);
    }
  }
}
function ledgerBlocks(w, c) {
  return LEDGER_KEYS.map(key => ({
    title_c: key.replace('_c', '').toUpperCase(),
    rows_c: [
      ...(w[key] ?? []).map((row, i) => [`${i + 1}. ${row.description_c}`, row.amount_c]),
      ['GRAND TOTAL', c.ledger_totals_c[key]],
    ],
  }));
}
export function exportExcel(w) {
  const c = calculate(w);
  const rows = [
    [heading('BORDER SECURITY FORCE — MESS SUMMARY')],
    [`Month: ${monthLabel(w.month_c)} | Amounts in INR`],
    [heading('No.'), heading('Item / Unit'), ...SECTION_LABELS.flatMap(s => [heading(s), null, null])],
    [null, null, ...SECTION_LABELS.flatMap(() => [heading('Qty'), heading('Rate'), heading('Amount')])],
  ];
  const merges = ['A1:Q1', 'A2:Q2', 'A3:A4', 'B3:B4'];
  SECTION_LABELS.forEach((_, i) => merges.push(`${column(2 + i * 3)}3:${column(4 + i * 3)}3`));
  c.items_c.forEach((item, i) => {
    const first = rows.length + 1;
    const group = item.sections_c;
    rows.push([
      i + 1, `${item.Name} (${item.unit_c})`,
      ...group.flatMap(batches => [
        totalCell(batchQuantity(batches)), totalCell(weightedRate(batches)), totalCell(batchAmount(batches)),
      ]),
    ]);
    const length = Math.max(1, ...group.map(b => b.length));
    for (let j = 0; j < length; j++) {
      rows.push([null, null, ...group.flatMap(batches => {
        const b = batches[j];
        return b ? [b.quantity_c, b.rate_c, Number(fixed(b.quantity_c * b.rate_c))] : [null, null, null];
      })]);
    }
    if (item.shortage_c > 0) {
      rows.push([null, `WARNING: expenditure exceeds stock by ${fixed(item.shortage_c)} ${item.unit_c}`]);
    }
    merges.push(`A${first}:A${rows.length}`, `B${first}:B${rows.length}`);
  });
  if (!c.items_c.length) {
    rows.push(['No items entered']);
    merges.push('A5:Q5');
  }
  rows.push([totalCell('GRAND TOTALS'), null, ...c.totals_c.flatMap(v => [null, null, totalCell(v)])]);
  merges.push(`A${rows.length}:B${rows.length}`);
  appendPairs(rows, merges, summaryBlocks(w, c));
  appendPairs(rows, merges, ledgerBlocks(w, c));
  rows.push([`Receipts less payments: ${fixed(c.ledger_totals_c.receipts_c - c.ledger_totals_c.payments_c)}`]);
  rows.push([`Assets less liabilities: ${fixed(c.ledger_totals_c.assets_c - c.ledger_totals_c.liabilities_c)}`]);

  const summaryRows = [[heading(`MESS SUMMARY — ${monthLabel(w.month_c)}`)]];
  const summaryMerges = ['A1:Q1'];
  appendPairs(summaryRows, summaryMerges, summaryBlocks(w, c));
  const ledgerRows = [[heading(`FINANCIAL LEDGERS — ${monthLabel(w.month_c)}`)]];
  const ledgerMerges = ['A1:Q1'];
  appendPairs(ledgerRows, ledgerMerges, ledgerBlocks(w, c));
  const sheets = [
    ['FIFO Inventory', makeSheet(rows, merges, [6, 28, ...Array(15).fill(12)])],
    ['Summary', makeSheet(summaryRows, summaryMerges, Array(17).fill(12))],
    ['Ledgers', makeSheet(ledgerRows, ledgerMerges, Array(17).fill(12))],
  ];
  const green = themeColor('--primary', '1F4D3A');
  const pale = themeColor('--secondary', 'EDF4ED');
  const edge = themeColor('--border', 'D5DED4');
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF${green}"/><name val="Calibri"/></font><font><sz val="10"/><name val="Consolas"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${pale}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF${edge}"/></left><right style="thin"><color rgb="FF${edge}"/></right><top style="thin"><color rgb="FF${edge}"/></top><bottom style="thin"><color rgb="FF${edge}"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"><alignment horizontal="right"/></xf><xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map(([, content], i) => [`xl/worksheets/sheet${i + 1}.xml`, content]),
  ];
  download(zip(files), `BSF_Mess_${w.month_c}.xlsx`);
}

export function exportCsv(w) {
  const c = calculate(w);
  const lines = [['Month', 'Item', 'Unit', 'Section', 'Batch', 'Quantity', 'Rate', 'Amount', 'Requested expenditure', 'Stock shortfall']];
  c.items_c.forEach(item => {
    item.sections_c.forEach((batches, i) => {
      batches.forEach((b, j) => lines.push([
        w.month_c, item.Name, item.unit_c, SECTION_LABELS[i], j + 1,
        fixed(b.quantity_c), fixed(b.rate_c), fixed(b.quantity_c * b.rate_c),
        fixed(item.expenditure_c), fixed(item.shortage_c),
      ]));
      if (!batches.length) lines.push([
        w.month_c, item.Name, item.unit_c, SECTION_LABELS[i], '', '0.00', '0.00', '0.00',
        fixed(item.expenditure_c), fixed(item.shortage_c),
      ]);
    });
  });
  const quote = v => {
    let value = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
    return `"${value.replace(/"/g, '""')}"`;
  };
  download(new Blob(['\ufeff' + lines.map(row => row.map(quote).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  }), `BSF_Mess_${w.month_c}_batches.csv`);
}

function pdfString(value) {
  return String(value ?? '').replace(/[^\x20-\x7E]/g, '-')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function createPdf() {
  const width = 1191;
  const height = 842;
  const pages = [];
  let stream = '';
  const text = (x, y, value, size = 9, bold = false, align = 'left') => {
    const str = pdfString(value);
    const dx = align === 'right' ? str.length * size * (bold ? 0.56 : 0.52) : 0;
    stream += `0.12 0.18 0.13 rg BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${fixed(x - dx)} ${fixed(height - y)} Tm (${str}) Tj ET\n`;
  };
  const box = (x, y, w, h, filled = false) => {
    stream += `${filled ? '0.91 0.95 0.91 rg' : '0.72 0.79 0.72 RG'} 0.4 w ${x} ${height - y - h} ${w} ${h} re ${filled ? 'B' : 'S'}\n`;
  };
  const rule = (x, y, w) => {
    stream += `0.12 0.30 0.22 RG 1.4 w ${x} ${height - y} m ${x + w} ${height - y} l S\n`;
  };
  const page = () => {
    if (stream) pages.push(stream);
    stream = '';
  };
  const finish = () => {
    if (stream) pages.push(stream);
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ];
    const kids = [];
    pages.forEach(content => {
      const pageId = objects.length + 1;
      const contentId = pageId + 1;
      kids.push(`${pageId} 0 R`);
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
      objects.push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
    });
    objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    let output = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((obj, i) => {
      offsets.push(encoder.encode(output).length);
      output += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const start = encoder.encode(output).length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { output += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
    return new Blob([output], { type: 'application/pdf' });
  };
  return { text, box, rule, page, finish };
}
export function exportPdf(w) {
  const c = calculate(w);
  const p = createPdf();
  let pageNo = 0;
  let y = 0;
  const startPage = title => {
    p.page();
    pageNo++;
    p.text(30, 33, 'BORDER SECURITY FORCE', 11, true);
    p.text(30, 58, 'BSF MESS SUMMARY SOFTWARE', 19, true);
    p.text(1161, 34, `${monthLabel(w.month_c)} | ${title}`, 10, false, 'right');
    p.text(1161, 57, `Amounts in INR | Page ${pageNo}`, 9, false, 'right');
    p.rule(30, 70, 1131);
    p.text(30, 819, 'FIFO: previous-month batches first, then received batches in entry order.', 8);
    y = 87;
  };
  const widths = [28, 158, ...Array(15).fill(63)];
  const positions = [30];
  widths.forEach(width => positions.push(positions[positions.length - 1] + width));
  const tableHeader = () => {
    p.box(30, y, 1131, 42, true);
    p.text(positions[0] + 5, y + 25, 'No.', 8, true);
    p.text(positions[1] + 5, y + 25, 'Item / Unit', 8, true);
    SECTION_LABELS.forEach((label, i) => {
      const x = positions[2 + i * 3];
      p.text(x + 5, y + 13, label, 8, true);
      ['Qty', 'Rate', 'Amount'].forEach((s, j) => p.text(positions[2 + i * 3 + j] + 5, y + 33, s, 8, true));
      p.rule(x, y + 20, 189);
    });
    y += 42;
  };
  const tableRow = (values, bold = false) => {
    if (y + 22 > 788) { startPage('Inventory continued'); tableHeader(); }
    values.forEach((value, i) => {
      p.box(positions[i], y, widths[i], 21, bold);
      const str = i === 1 ? String(value ?? '').slice(0, 30) : value;
      p.text(i >= 2 ? positions[i + 1] - 5 : positions[i] + 4, y + 14, str, 8, bold, i >= 2 ? 'right' : 'left');
    });
    y += 21;
  };
  startPage('FIFO inventory');
  tableHeader();
  c.items_c.forEach((item, i) => {
    tableRow([i + 1, `${item.Name} (${item.unit_c})`, ...item.sections_c.flatMap(batches => [
      fixed(batchQuantity(batches)), fixed(weightedRate(batches)), fixed(batchAmount(batches)),
    ])], true);
    const count = Math.max(1, ...item.sections_c.map(b => b.length));
    for (let j = 0; j < count; j++) {
      tableRow(['', j === 0 ? 'Batch detail' : '', ...item.sections_c.flatMap(batches => {
        const b = batches[j];
        return b ? [fixed(b.quantity_c), fixed(b.rate_c), fixed(b.quantity_c * b.rate_c)] : ['', '', ''];
      })]);
    }
    if (item.shortage_c > 0) {
      tableRow(['!', `Shortfall ${fixed(item.shortage_c)} ${item.unit_c}`, ...Array(15).fill('')]);
    }
  });
  if (!c.items_c.length) tableRow(['', 'No items entered', ...Array(15).fill('')]);
  tableRow(['', 'GRAND TOTALS', ...c.totals_c.flatMap(v => ['', '', fixed(v)])], true);
  y += 20;

  const panelPairs = blocks => {
    for (let index = 0; index < blocks.length; index += 2) {
      const pair = blocks.slice(index, index + 2);
      const maxRows = Math.max(...pair.map(b => b.rows_c.length), 1);
      let offset = 0;
      while (offset < maxRows) {
        if (y + 75 > 788) startPage('Summary and ledgers');
        const capacity = Math.max(1, Math.floor((788 - y - 34) / 21));
        const used = Math.min(capacity, maxRows - offset);
        pair.forEach((block, side) => {
          const x = side ? 608 : 30;
          p.box(x, y, 553, 29, true);
          p.rule(x, y, 553);
          p.text(x + 10, y + 19, block.title_c + (offset ? ' (continued)' : ''), 11, true);
          for (let j = 0; j < used; j++) {
            const row = block.rows_c[offset + j];
            if (!row) continue;
            const rowY = y + 29 + j * 21;
            p.box(x, rowY, 553, 21);
            p.text(x + 10, rowY + 14, row[0].slice(0, 72), 9);
            p.text(x + 542, rowY + 14, fixed(row[1]), 9, false, 'right');
          }
        });
        y += 29 + used * 21 + 18;
        offset += used;
        if (offset < maxRows) startPage('Ledgers continued');
      }
    }
  };
  panelPairs(summaryBlocks(w, c));
  panelPairs(ledgerBlocks(w, c));
  if (y > 748) startPage('Ledger reconciliation');
  p.text(30, y + 8, `Receipts less payments: ${fixed(c.ledger_totals_c.receipts_c - c.ledger_totals_c.payments_c)}`, 10, true);
  p.text(608, y + 8, `Assets less liabilities: ${fixed(c.ledger_totals_c.assets_c - c.ledger_totals_c.liabilities_c)}`, 10, true);
  download(p.finish(), `BSF_Mess_${w.month_c}.pdf`);
}