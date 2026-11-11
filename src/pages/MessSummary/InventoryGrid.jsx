import { useState } from 'react';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import LedgerNumber from '@/components/LedgerNumber';
import {
  SECTION_LABELS, batchQuantity, batchAmount, weightedRate, money, fixed,
} from '@/lib/messWorksheet';

const smallButton = 'h-8 rounded-sm px-2 text-xs shadow-none transition-colors duration-[var(--transition-fast)] focus-visible:ring-2 focus-visible:ring-ring';
function BatchAdd({ item, section, onAdd }) {
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [validation, setValidation] = useState('');
  return (
    <form className="no-print mt-2 grid grid-cols-[1fr_1fr_auto] gap-1 border-t border-border pt-2" onSubmit={event => {
      event.preventDefault();
      if (quantity <= 0 || rate <= 0) {
        setValidation('Enter a quantity and rate greater than zero.');
        return;
      }
      onAdd(item.Id, section, quantity, rate);
      setQuantity(0);
      setRate(0);
      setValidation('');
    }}>
      <div className="space-y-2">
        <label className="sr-only" htmlFor={`quantity-${item.Id}-${section}`}>Batch quantity</label>
        <LedgerNumber value={quantity} onChange={setQuantity} label={`${item.Name} ${section === 'previous_c' ? 'previous' : 'received'} batch quantity`} />
      </div>
      <div className="space-y-2">
        <label className="sr-only">Batch rate</label>
        <LedgerNumber value={rate} onChange={setRate} label={`${item.Name} batch rate in rupees`} />
      </div>
      <Button type="submit" title="Add batch" aria-label={`Add ${section === 'previous_c' ? 'previous-month' : 'received'} batch for ${item.Name}`} className={`${smallButton} h-11 bg-primary text-primary-foreground hover:bg-primary/90 md:h-8`}>
        <ApperIcon name="Plus" className="h-3 w-3" />
      </Button>
      {validation && <p role="alert" className="col-span-3 text-xs text-destructive">{validation}</p>}
    </form>
  );
}
function RemoveBatch({ item, section, batch, onRemove }) {
  return (
    <button type="button" aria-label={`Remove batch of ${fixed(batch.quantity_c)} ${item.unit_c} at ${fixed(batch.rate_c)} for ${item.Name}`}
      onClick={() => onRemove(item.Id, section, batch.Id)}
      className="no-print flex h-7 w-5 shrink-0 items-center justify-center rounded-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ApperIcon name="X" className="h-3 w-3" />
    </button>
  );
}
function ItemActions({ item, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="no-print mt-3 flex flex-wrap gap-1">
      {confirm ? <>
        <Button type="button" onClick={() => onDelete(item.Id)} className={`${smallButton} bg-destructive text-destructive-foreground hover:bg-destructive/90`}>Delete?</Button>
        <Button type="button" variant="outline" onClick={() => setConfirm(false)} className={`${smallButton} border-border hover:bg-muted`}>No</Button>
      </> : (
        <button type="button" aria-label={`Delete ${item.Name}`} onClick={() => setConfirm(true)}
          className="flex h-8 items-center gap-1 rounded-sm px-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ApperIcon name="Trash2" className="h-3 w-3" /> Delete item
        </button>
      )}
    </div>
  );
}
function Warning({ item }) {
  return item.shortage_c > 0 ? (
    <p key={`${item.Id}-${item.expenditure_c}`} role="status"
      className="ledger-warning mt-2 border-l-2 border-destructive bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
      Exceeds stock by {fixed(item.shortage_c)} {item.unit_c}
    </p>
  ) : null;
}
function BatchDetail({ item, index, onAdd, onRemove }) {
  const batches = item.sections_c[index];
  const editable = index < 2;
  const section = index === 0 ? 'previous_c' : 'received_c';
  return (
    <section className="border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3 border-b-[3px] border-double border-primary pb-2">
        <h3 className="font-heading text-xs font-semibold">{SECTION_LABELS[index]}</h3>
        <span className="ledger-numeric text-xs font-bold">₹ {money(batchAmount(batches))}</span>
      </div>
      {(batches ?? []).length ? batches.map((batch, i) => (
        <div key={`${batch.Id}-${i}`} className="flex min-h-11 items-center justify-between gap-2 border-b border-dashed border-border text-sm">
          <span className="ledger-numeric">{fixed(batch.quantity_c)} {item.unit_c} × ₹ {fixed(batch.rate_c)}</span>
          <span className="flex items-center gap-2 ledger-numeric">
            {money(batch.quantity_c * batch.rate_c)}
            {editable && <RemoveBatch item={item} section={section} batch={batch} onRemove={onRemove} />}
          </span>
        </div>
      )) : <p className="py-2 text-sm text-muted-foreground">No batches in this section.</p>}
      {editable && <BatchAdd item={item} section={section} onAdd={onAdd} />}
    </section>
  );
}
export default function InventoryGrid({ computed, onAddBatch, onRemoveBatch, onExpenditure, onDelete, loading, onFocusCreate }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = (computed.items_c ?? []).find(item => String(item.Id) === String(selectedId));
  const items = computed.items_c ?? [];
  return (
    <>
      <div className="print-table-wrap overflow-x-auto border border-border bg-card shadow-[var(--shadow-xs)]" tabIndex={0} aria-label="Scrollable FIFO inventory register">
        <table className="ledger-table">
          <caption className="sr-only">FIFO inventory for the selected month. Quantities are in each item’s unit; rates and amounts are in rupees.</caption>
          <colgroup><col style={{ width: '42px' }} /><col style={{ width: '185px' }} />{Array.from({ length: 15 }, (_, i) => <col key={i} />)}</colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>#</th>
              <th rowSpan={2} className="item-cell text-left">Item / Unit</th>
              {SECTION_LABELS.map(label => <th key={label} colSpan={3} className="section-start font-heading text-[11px] font-semibold">{label}</th>)}
            </tr>
            <tr>{SECTION_LABELS.flatMap((section, i) => ['Qty', 'Rate', 'Amount'].map((label, j) => (
              <th key={`${section}-${label}`} className={`${j === 0 ? 'section-start' : ''} text-right text-[10px] font-semibold`}>{label}{j > 0 && <span className="ml-1 font-normal text-muted-foreground">₹</span>}</th>
            )))}</tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 3 }, (_, i) => (
              <tr key={i}><td colSpan={17}><div className="h-20 animate-pulse bg-muted" /></td></tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={17}>
                <div className="m-4 flex min-h-32 items-center gap-5 border border-dashed border-border border-l-4 border-l-primary bg-muted/30 p-6">
                  <ApperIcon name="ClipboardList" className="h-9 w-9 shrink-0 text-primary" />
                  <div><p className="font-heading text-sm font-semibold">No items — use the Add New Item form above.</p><p className="mt-1 text-sm text-muted-foreground">Enter opening batches first, then this month’s purchases.</p>
                    <Button type="button" onClick={onFocusCreate} className={`${smallButton} no-print mt-3 bg-primary text-primary-foreground hover:bg-primary/90`}>Add first item</Button>
                  </div>
                </div>
              </td></tr>
            ) : items.map((item, index) => (
              <tr key={item.Id}>
                <td className="ledger-numeric text-center text-muted-foreground">{index + 1}</td>
                <td className="item-cell">
                  <p className="break-words text-[13px] font-semibold">{item.Name}</p>
                  <p className="mt-1 ledger-numeric text-[10px] text-muted-foreground">UNIT · {item.unit_c}</p>
                  <ItemActions item={item} onDelete={onDelete} />
                </td>
                {item.sections_c.flatMap((batches, sectionIndex) => {
                  const editable = sectionIndex < 2;
                  const section = sectionIndex === 0 ? 'previous_c' : 'received_c';
                  return [
                    <td key={`${sectionIndex}-qty`} className={`section-start ledger-numeric text-right ${sectionIndex === 3 && item.shortage_c > 0 ? 'overdraw-cell' : ''}`}>
                      <div className="amount-total">{fixed(batchQuantity(batches))}</div>
                      {(batches ?? []).map((batch, i) => <div className="batch-line" key={`${batch.Id}-${i}`}>{fixed(batch.quantity_c)}</div>)}
                      {sectionIndex === 3 && <>
                        <div className="no-print mt-2 hidden space-y-2 border-t border-border pt-2 md:block">
                          <label className="block text-left font-sans text-[10px] text-muted-foreground">Consumed · {item.unit_c}</label>
                          <LedgerNumber value={item.expenditure_c} onChange={v => onExpenditure(item.Id, v)} label={`Expenditure quantity for ${item.Name}`} />
                        </div>
                        <Button type="button" onClick={() => setSelectedId(item.Id)} variant="outline" className="no-print mt-2 h-11 w-full rounded-sm border-primary px-1 text-[10px] hover:bg-accent md:hidden">Enter qty</Button>
                        <Warning item={item} />
                      </>}
                    </td>,
                    <td key={`${sectionIndex}-rate`} className="ledger-numeric text-right">
                      <div className="amount-total">{fixed(weightedRate(batches))}</div>
                      {(batches ?? []).map((batch, i) => <div className="batch-line" key={`${batch.Id}-${i}`}>{fixed(batch.rate_c)}</div>)}
                      {editable && <p className="no-print mt-3 text-[10px] text-muted-foreground">Qty + rate →</p>}
                    </td>,
                    <td key={`${sectionIndex}-amount`} className="ledger-numeric text-right">
                      <div className="amount-total">{money(batchAmount(batches))}</div>
                      {(batches ?? []).map((batch, i) => <div className="batch-line" key={`${batch.Id}-${i}`}>
                        {money(batch.quantity_c * batch.rate_c)}
                        {editable && <RemoveBatch item={item} section={section} batch={batch} onRemove={onRemoveBatch} />}
                      </div>)}
                      {editable && <BatchAdd item={item} section={section} onAdd={onAddBatch} />}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-secondary font-bold">
              <td colSpan={2} className="font-heading text-xs">GRAND TOTALS · ₹</td>
              {computed.totals_c.map((amount, index) => <td key={index} colSpan={3} className="section-start ledger-numeric text-right">{money(amount)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <Sheet open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <SheetContent side="bottom" className="flex max-h-[85vh] flex-col gap-0 rounded-t-sm bg-card p-0">
          <SheetHeader className="shrink-0 border-b border-border p-4 text-left">
            <SheetTitle className="font-heading text-base">{selected?.Name ?? 'Item detail'}</SheetTitle>
            <SheetDescription>FIFO batch detail · {selected?.unit_c}. Opening stock is consumed first.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {selected && <>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Expenditure quantity · {selected.unit_c}</label>
                <LedgerNumber value={selected.expenditure_c} onChange={v => onExpenditure(selected.Id, v)} label={`Expenditure quantity for ${selected.Name}`} className="h-11 text-base" />
                <Warning item={selected} />
              </div>
              {SECTION_LABELS.map((label, index) => <BatchDetail key={label} item={selected} index={index} onAdd={onAddBatch} onRemove={onRemoveBatch} />)}
            </>}
          </div>
          <SheetFooter className="shrink-0 border-t border-border p-4">
            <Button type="button" onClick={() => setSelectedId(null)} className="h-11 w-full rounded-sm bg-primary font-semibold text-primary-foreground hover:bg-primary/90">Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}