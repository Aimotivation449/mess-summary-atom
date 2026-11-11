import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { monthLabel, money, fixed, batchAmount } from '@/lib/messWorksheet';

const actionClass = 'active:scale-[0.98] transition-transform duration-(--transition-fast)';

export default function CarryForwardPreview({ preview, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const rows = preview.changes_c ?? [];
  return (
    <>
      <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
        <DialogContent className="no-print flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border p-4 pr-12">
            <DialogTitle className="text-base font-heading font-semibold">Carry-forward preview</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {monthLabel(preview.source_month_c)} → {monthLabel(preview.worksheet_c.month_c)}. Nothing changes until you confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
            <p className="border-l-4 border-primary bg-secondary p-4 text-sm leading-relaxed text-secondary-foreground">
              {preview.restored_c ? 'The next month already has a saved worksheet.' : 'A new next-month worksheet will be created.'}
              {' '}Matching items’ opening batches will be replaced, not added twice. Purchases, expenditure, other inventory items, attendance and ledgers stay unchanged. New items start with no purchases or expenditure.
            </p>
            <section className="space-y-4">
              <h3 className="text-base font-heading font-semibold">Opening inventory changes</h3>
              {rows.length ? <div className="divide-y divide-border border border-border bg-card">
                {rows.map(row => (
                  <div key={row.Id} className="space-y-4 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="min-w-0 break-words text-sm font-medium">{row.Name} ({row.unit_c})</h4>
                      <span className="text-sm text-muted-foreground">{row.existing_c ? 'Replace opening batches' : 'Add inventory item'}</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        { label: 'Existing opening batches', batches: row.previous_c },
                        { label: 'Proposed opening batches · FIFO order', batches: row.batches_c },
                      ].map(group => (
                        <div key={group.label} className="min-w-0 space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                          {group.batches.length ? <ol className="space-y-1 text-sm leading-relaxed tabular-nums">
                            {group.batches.map((batch, index) => <li key={batch.Id} className="break-words">
                              {index + 1}. {fixed(batch.quantity_c)} {row.unit_c} × ₹ {money(batch.rate_c)}
                            </li>)}
                          </ol> : <p className="text-sm text-muted-foreground">No opening stock</p>}
                          <p className="text-sm tabular-nums">Value: ₹ {money(batchAmount(group.batches))}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div> : <p className="text-sm text-muted-foreground">No remaining inventory batches to copy.</p>}
            </section>
            <section className="space-y-4 border-t border-border pt-4">
              <h3 className="text-base font-heading font-semibold">Fresh-ration opening balance</h3>
              <dl className="space-y-2 text-sm tabular-nums">
                <div className="flex gap-4"><dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">Existing</dt><dd className="min-w-0 break-words">₹ {money(preview.fresh_before_c)}</dd></div>
                <div className="flex gap-4"><dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">Proposed</dt><dd className="min-w-0 break-words">₹ {money(preview.fresh_after_c)}</dd></div>
              </dl>
              <p className="text-sm text-muted-foreground">This replaces “Previous month fresh received”. Next month’s fresh purchases and expenditure are preserved.</p>
            </section>
          </div>
          <DialogFooter className="shrink-0 border-t border-border p-4">
            <Button type="button" variant="outline" onClick={onClose} className={actionClass}>Cancel</Button>
            <Button type="button" onClick={() => setConfirming(true)} className={actionClass}>Continue to confirmation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="no-print">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm carry-forward?</AlertDialogTitle>
            <AlertDialogDescription>
              Save the previewed opening balances to {monthLabel(preview.worksheet_c.month_c)}?
              {' '}Existing opening batches for matching items and the fresh-ration opening balance will be replaced. The source month is unchanged. Export the next month first if you need a backup of its current opening entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={actionClass}>Back to preview</AlertDialogCancel>
            <Button type="button" onClick={() => { setConfirming(false); onConfirm(); }} className={actionClass}>Confirm carry-forward</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}