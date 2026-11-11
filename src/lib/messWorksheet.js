export const UNITS = ['KG', 'L', 'PCS', 'Pkt', 'Bag', 'Unit'];
export const SECTION_LABELS = [
  'Previous Month', 'Received This Month', 'Total Received',
  'Expenditure FIFO', 'Balance Next Month',
];
export const STORAGE_PREFIX = 'bsf-mess-worksheet:v1:';
export const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const numeric = value => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
export const fixed = value => round2(Number(value) || 0).toFixed(2);
export const money = value => new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(round2(Number(value) || 0));

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function monthLabel(month) {
  const [year, m] = String(month).split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });
}
export function monthDays(month) {
  const [year, m] = String(month).split('-').map(Number);
  return new Date(year, m, 0).getDate();
}
export function blankWorksheet(month) {
  return {
    month_c: month,
    items_c: [],
    fresh_previous_c: 0,
    fresh_purchased_c: 0,
    fresh_expenditure_c: 0,
    casual_diet_c: 0,
    ri_amount_c: 0,
    bara_khana_c: 0,
    attendance_c: 0,
    casual_attendance_c: 0,
    ri_attendance_c: 0,
    rma_c: 0,
    recovery_c: 0,
    receipts_c: [],
    payments_c: [],
    assets_c: [],
    liabilities_c: [],
  };
}
const numericKeys = [
  'fresh_previous_c', 'fresh_purchased_c', 'fresh_expenditure_c',
  'casual_diet_c', 'ri_amount_c', 'bara_khana_c', 'attendance_c',
  'casual_attendance_c', 'ri_attendance_c', 'rma_c', 'recovery_c',
];
export const LEDGER_KEYS = ['receipts_c', 'payments_c', 'assets_c', 'liabilities_c'];

function normalizeBatches(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(b => b && typeof b.Id === 'string').map(b => ({
    Id: b.Id,
    quantity_c: round2(numeric(b.quantity_c)),
    rate_c: round2(numeric(b.rate_c)),
  }));
}
export function readWorksheet(month) {
  const raw = localStorage.getItem(STORAGE_PREFIX + month);
  if (!raw) return { worksheet_c: blankWorksheet(month), restored_c: false };
  const saved = JSON.parse(raw);
  if (!saved || saved.month_c !== month || !Array.isArray(saved.items_c)) {
    throw new Error('This month’s saved worksheet could not be read. Your saved copy has not been overwritten.');
  }
  const next = blankWorksheet(month);
  numericKeys.forEach(key => { next[key] = round2(numeric(saved[key])); });
  next.items_c = saved.items_c.filter(r => r && typeof r.Id === 'string').map(r => ({
    Id: r.Id,
    Name: String(r.Name ?? ''),
    unit_c: UNITS.includes(r.unit_c) ? r.unit_c : UNITS[0],
    previous_c: normalizeBatches(r.previous_c),
    received_c: normalizeBatches(r.received_c),
    expenditure_c: round2(numeric(r.expenditure_c)),
  }));
  LEDGER_KEYS.forEach(key => {
    next[key] = (Array.isArray(saved[key]) ? saved[key] : [])
      .filter(r => r && typeof r.Id === 'string')
      .map(r => ({
        Id: r.Id, description_c: String(r.description_c ?? ''),
        amount_c: round2(numeric(r.amount_c)),
      }));
  });
  return { worksheet_c: next, restored_c: true };
}
export function batchQuantity(batches) {
  return round2((batches ?? []).reduce((sum, b) => sum + numeric(b.quantity_c), 0));
}
export function batchAmount(batches) {
  return round2((batches ?? []).reduce(
    (sum, b) => sum + round2(numeric(b.quantity_c) * numeric(b.rate_c)), 0,
  ));
}
export function weightedRate(batches) {
  const q = batchQuantity(batches);
  return q ? round2(batchAmount(batches) / q) : 0;
}
export function mergeRates(batches) {
  const result = [];
  (batches ?? []).forEach(b => {
    const found = result.find(x => x.rate_c === b.rate_c);
    if (found) found.quantity_c = round2(found.quantity_c + b.quantity_c);
    else result.push({ ...b });
  });
  return result;
}
export function fifo(item) {
  const all = [...(item.previous_c ?? []), ...(item.received_c ?? [])];
  let remaining = numeric(item.expenditure_c);
  const used = [];
  const left = [];
  all.forEach(b => {
    const consumed = Math.min(b.quantity_c, remaining);
    remaining = round2(Math.max(0, remaining - consumed));
    if (consumed > 0) used.push({ ...b, quantity_c: consumed });
    const balance = round2(b.quantity_c - consumed);
    if (balance > 0) left.push({ ...b, quantity_c: balance });
  });
  return {
    sections_c: [item.previous_c ?? [], item.received_c ?? [], mergeRates(all), used, left],
    shortage_c: round2(remaining),
  };
}
export function calculate(worksheet) {
  const items = (worksheet.items_c ?? []).map(item => ({ ...item, ...fifo(item) }));
  const totals = SECTION_LABELS.map((_, i) => round2(items.reduce(
    (sum, item) => sum + batchAmount(item.sections_c[i]), 0,
  )));
  const freshTotal = round2(worksheet.fresh_previous_c + worksheet.fresh_purchased_c);
  const freshBalance = round2(freshTotal - worksheet.fresh_expenditure_c);
  const rationTotal = round2(totals[3] + worksheet.fresh_expenditure_c);
  const net = round2(rationTotal - worksheet.casual_diet_c - worksheet.ri_amount_c - worksheet.bara_khana_c);
  const attendance = Math.max(0, round2(
    worksheet.attendance_c - worksheet.casual_attendance_c - worksheet.ri_attendance_c,
  ));
  const days = monthDays(worksheet.month_c);
  const perDay = round2(worksheet.rma_c / days);
  const profit = round2(worksheet.recovery_c - net);
  const ledgerTotals = Object.fromEntries(LEDGER_KEYS.map(key => [
    key, round2((worksheet[key] ?? []).reduce((sum, row) => sum + numeric(row.amount_c), 0)),
  ]));
  return {
    items_c: items, totals_c: totals, fresh_total_c: freshTotal,
    fresh_balance_c: freshBalance, ration_total_c: rationTotal,
    net_c: net, attendance_net_c: attendance, days_c: days,
    per_day_c: perDay, profit_c: profit, ledger_totals_c: ledgerTotals,
    overdraw_c: items.some(item => item.shortage_c > 0),
  };
}
export function summaryBlocks(w, c) {
  return [
    {
      title_c: 'Inventory Summary',
      rows_c: SECTION_LABELS.map((label, i) => [label, c.totals_c[i]]),
    },
    {
      title_c: 'Additional Summary',
      rows_c: [
        ['Previous month fresh received', w.fresh_previous_c],
        ['This month fresh purchased', w.fresh_purchased_c],
        ['Total fresh purchased', c.fresh_total_c],
        ['Fresh expenditure', w.fresh_expenditure_c],
        ['Fresh balance next month', c.fresh_balance_c],
      ],
    },
    {
      title_c: 'Ration Consumption',
      rows_c: [
        ['Dry ration consumed', c.totals_c[3]],
        ['Fresh ration consumed', w.fresh_expenditure_c],
        ['Total ration consumed', c.ration_total_c],
        ['Less casual diet', w.casual_diet_c],
        ['Less RI person', w.ri_amount_c],
        ['Less bara khana', w.bara_khana_c],
        ['Net amount', c.net_c],
      ],
    },
    {
      title_c: 'Attendance & Diet',
      rows_c: [
        ['Total attendance', w.attendance_c],
        ['Less casual attendance', w.casual_attendance_c],
        ['Less RI attendance', w.ri_attendance_c],
        ['Net attendance', c.attendance_net_c],
        ['Days in selected month', c.days_c],
        ['RMA per month', w.rma_c],
        ['Per day diet amount', c.per_day_c],
        ['Recovery from jawans', w.recovery_c],
        ['Mess profit', c.profit_c],
      ],
    },
  ];
}