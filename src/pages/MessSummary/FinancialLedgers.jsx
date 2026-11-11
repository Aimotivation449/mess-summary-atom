import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LedgerNumber from '@/components/LedgerNumber';
import { money, round2 } from '@/lib/messWorksheet';
import { Panel } from './SummaryPanels';

const TITLES = {
  receipts_c: 'Receipts', payments_c: 'Payments', assets_c: 'Assets', liabilities_c: 'Liabilities',
};
function Ledger({ ledgerKey, rows, total, onAdd, onEdit, onRemove }) {
  const title = TITLES[ledgerKey];
  return (
    <Panel title={title} eyebrow="Description · Amount in rupees">
      <div className="space-y-2">
        {(rows ?? []).length ? rows.map((row, index) => (
          <div key={row.Id} className="grid grid-cols-[22px_minmax(0,1fr)_110px_28px] items-start gap-2 border-b border-dashed border-border pb-2">
            <span className="ledger-numeric pt-3 text-xs text-muted-foreground md:pt-2">{index + 1}</span>
            <div className="space-y-2">
              <label className="sr-only" htmlFor={`${row.Id}-description`}>{title} line {index + 1} description</label>
              <Input id={`${row.Id}-description`} value={row.description_c} maxLength={180} placeholder="Description"
                onChange={event => onEdit(ledgerKey, row.Id, 'description_c', event.target.value)}
                className="h-11 rounded-sm border-input bg-card px-2 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/25 md:h-8" />
            </div>
            <div className="space-y-2">
              <label className="sr-only">{title} line {index + 1} amount</label>
              <LedgerNumber value={row.amount_c} onChange={value => onEdit(ledgerKey, row.Id, 'amount_c', value)} label={`${title} line ${index + 1} amount`} />
            </div>
            <button type="button" onClick={() => onRemove(ledgerKey, row.Id)} aria-label={`Remove ${title.toLowerCase()} line ${index + 1}`}
              className="no-print flex h-11 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8">
              <ApperIcon name="X" className="h-4 w-4" />
            </button>
          </div>
        )) : <div className="flex items-center gap-3 border border-dashed border-border border-l-2 border-l-primary bg-muted/30 p-4 text-sm text-muted-foreground">
          <ApperIcon name="NotebookPen" className="h-5 w-5 shrink-0" />
          <p>No {title.toLowerCase()} entered. Add a line from the register.</p>
        </div>}
      </div>
      <Button type="button" variant="outline" onClick={() => onAdd(ledgerKey)}
        className="no-print mt-3 h-9 rounded-sm border-border px-3 text-xs font-semibold text-primary hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <ApperIcon name="Plus" className="mr-1 h-3 w-3" /> Add {title.toLowerCase()} line
      </Button>
      <div className="mt-4 flex items-center justify-between border-t-[3px] border-double border-primary bg-secondary px-3 py-3">
        <span className="font-heading text-xs font-semibold uppercase">Grand total</span>
        <output className="ledger-numeric text-sm font-bold">₹ {money(total)}</output>
      </div>
    </Panel>
  );
}
function Tally({ first, second, firstTotal, secondTotal }) {
  const difference = round2(firstTotal - secondTotal);
  return (
    <div role="status" className={`flex flex-wrap items-center gap-2 border-l-4 px-4 py-3 text-sm ${difference === 0 ? 'border-success bg-success-muted text-success' : 'border-destructive bg-destructive/10 text-destructive'}`}>
      <ApperIcon name={difference === 0 ? 'CircleCheck' : 'TriangleAlert'} className="h-4 w-4 shrink-0" />
      <span className="font-semibold">{difference === 0 ? `${first} and ${second.toLowerCase()} balance.` : `${difference > 0 ? first : second} exceed ${difference > 0 ? second.toLowerCase() : first.toLowerCase()} by ₹ ${money(Math.abs(difference))}.`}</span>
    </div>
  );
}
export default function FinancialLedgers({ worksheet, computed, onAdd, onEdit, onRemove }) {
  return (
    <div className="space-y-6">
      {[['receipts_c', 'payments_c', 'Receipts and Payments'], ['assets_c', 'liabilities_c', 'Assets and Liabilities']].map(([left, right, title]) => (
        <section key={left} className="space-y-3" aria-label={title}>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-sm font-semibold">{title}</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="print-panels grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[left, right].map(key => <Ledger key={key} ledgerKey={key} rows={worksheet[key]} total={computed.ledger_totals_c[key]} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove} />)}
          </div>
          <Tally first={TITLES[left]} second={TITLES[right]} firstTotal={computed.ledger_totals_c[left]} secondTotal={computed.ledger_totals_c[right]} />
        </section>
      ))}
    </div>
  );
}