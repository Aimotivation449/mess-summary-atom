import LedgerNumber from '@/components/LedgerNumber';
import { money, fixed, SECTION_LABELS } from '@/lib/messWorksheet';

export function Panel({ title, eyebrow, children, className = '' }) {
  return (
    <section className={`ledger-panel border border-border border-l-4 border-l-primary bg-card p-5 shadow-[var(--shadow-xs)] ${className}`}>
      <header className="mb-4 border-b-[3px] border-double border-primary pb-3">
        {eyebrow && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>}
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  );
}
function Figure({ label, value, highlight = false, count = false, negative = false }) {
  return (
    <div className={`flex min-h-10 items-center justify-between gap-3 border-b border-dashed border-border px-2 py-2 text-sm ${highlight ? 'my-2 border-l-2 border-l-primary bg-success-muted font-semibold text-success' : ''}`}>
      <span>{label}</span>
      <output className={`ledger-numeric shrink-0 text-right text-sm font-semibold ${negative && value < 0 ? 'text-destructive' : ''}`}>{count ? fixed(value) : `₹ ${money(value)}`}</output>
    </div>
  );
}
function Entry({ label, field, worksheet, onChange }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-3 border-b border-dashed border-border px-2 py-2">
      <div className="space-y-2"><label className="text-sm" htmlFor={field}>{label}</label></div>
      <div className="space-y-2"><LedgerNumber value={worksheet[field]} onChange={value => onChange(field, value)} label={label} /></div>
    </div>
  );
}
export default function SummaryPanels({ worksheet: w, computed: c, onChange }) {
  return (
    <div className="print-panels grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Inventory Summary" eyebrow="Calculated from FIFO">
        {SECTION_LABELS.map((label, i) => <Figure key={label} label={label} value={c.totals_c[i]} highlight={i === 3} />)}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Amounts only are totalled across items. Each quantity retains its own unit; section rates are weighted averages.</p>
      </Panel>
      <Panel title="Additional Summary" eyebrow="Fresh ration account">
        <Entry label="Previous month fresh received" field="fresh_previous_c" worksheet={w} onChange={onChange} />
        <Entry label="This month fresh purchased" field="fresh_purchased_c" worksheet={w} onChange={onChange} />
        <Figure label="Total fresh purchased" value={c.fresh_total_c} highlight />
        <Entry label="Fresh expenditure this month" field="fresh_expenditure_c" worksheet={w} onChange={onChange} />
        <Figure label="Fresh balance next month" value={c.fresh_balance_c} negative />
        {c.fresh_balance_c < 0 && <p role="status" className="mt-3 text-xs text-destructive">Fresh expenditure exceeds the available fresh-ration balance.</p>}
      </Panel>
      <Panel title="Ration Consumption" eyebrow="Deductions and net account">
        <Figure label="Dry ration consumed" value={c.totals_c[3]} />
        <Figure label="Fresh ration consumed" value={w.fresh_expenditure_c} />
        <Figure label="Total ration consumed" value={c.ration_total_c} highlight />
        <Entry label="Less casual diet" field="casual_diet_c" worksheet={w} onChange={onChange} />
        <Entry label="Less RI person" field="ri_amount_c" worksheet={w} onChange={onChange} />
        <Entry label="Less bara khana" field="bara_khana_c" worksheet={w} onChange={onChange} />
        <Figure label="Net amount" value={c.net_c} highlight negative />
      </Panel>
      <Panel title="Attendance & Diet" eyebrow="Monthly diet calculation">
        <Entry label="Total attendance" field="attendance_c" worksheet={w} onChange={onChange} />
        <Entry label="Less casual attendance" field="casual_attendance_c" worksheet={w} onChange={onChange} />
        <Entry label="Less RI attendance" field="ri_attendance_c" worksheet={w} onChange={onChange} />
        <Figure label="Net attendance" value={c.attendance_net_c} count />
        <Figure label="Days in selected month" value={c.days_c} count />
        <Entry label="RMA per month" field="rma_c" worksheet={w} onChange={onChange} />
        <Figure label="Per day diet amount" value={c.per_day_c} />
        <Entry label="Recovery from jawans" field="recovery_c" worksheet={w} onChange={onChange} />
        <Figure label="Mess profit" value={c.profit_c} highlight negative />
        <p className="mt-3 text-xs text-muted-foreground">Per day diet = RMA ÷ days. Mess profit = recovery − net ration amount.</p>
        {w.casual_attendance_c + w.ri_attendance_c > w.attendance_c && <p role="status" className="mt-2 text-xs text-destructive">Attendance deductions exceed total attendance. Check the register entries.</p>}
      </Panel>
    </div>
  );
}