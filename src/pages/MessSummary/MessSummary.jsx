import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  UNITS, blankWorksheet, calculate, currentMonth, readWorksheet,
  STORAGE_PREFIX, monthLabel, round2, money, nextMonth, buildCarryForward,
} from '@/lib/messWorksheet';
import { exportExcel, exportPdf, exportCsv } from '@/lib/messExports';
import InventoryGrid from './InventoryGrid';
import SummaryPanels from './SummaryPanels';
import FinancialLedgers from './FinancialLedgers';
import CarryForwardPreview from './CarryForwardPreview';
import '@/styles/ledger.css';

export const route = { path: '/', layout: 'public', access: 'public' };

const controlButton = 'h-10 rounded-sm px-3 text-xs font-semibold shadow-none transition-colors duration-[var(--transition-fast)] focus-visible:ring-2 focus-visible:ring-ring';
export default function MessSummary() {
  const [worksheet, setWorksheet] = useState(() => blankWorksheet(currentMonth()));
  const [month, setMonth] = useState(currentMonth);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Loading worksheet');
  const [exporting, setExporting] = useState('');
  const [carryPreview, setCarryPreview] = useState(null);
  const nameInput = useRef(null);
  const savedOnce = useRef(false);
  const lastStorageError = useRef('');
  const computed = useMemo(() => calculate(worksheet), [worksheet]);

  useEffect(() => {
    let timer;
    setReady(false);
    setLoading(true);
    setRestoreError('');
    setStorageError('');
    savedOnce.current = false;
    try {
      const result = readWorksheet(month);
      setWorksheet(result.worksheet_c);
      setRestored(result.restored_c);
      setSaveStatus(result.restored_c ? 'Saved worksheet restored' : 'New monthly worksheet');
      setReady(true);
    } catch (error) {
      setWorksheet(blankWorksheet(month));
      setRestored(false);
      setRestoreError(error.message || 'Browser storage is unavailable.');
      setSaveStatus('Autosave paused');
    }
    timer = setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(timer);
  }, [month]);

  useEffect(() => {
    if (!ready || worksheet.month_c !== month) return;
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    setSaveStatus('Saving locally…');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_PREFIX + month, JSON.stringify(worksheet));
        setSaveStatus('Saved on this browser');
        setStorageError('');
        lastStorageError.current = '';
      } catch (error) {
        const message = 'Autosave failed. Export a copy now; browser storage may be full or blocked.';
        setSaveStatus('Autosave unavailable');
        setStorageError(message);
        if (lastStorageError.current !== message) {
          toast.error(message);
          console.error(`Monthly worksheet autosave failed: ${error.message}`);
          lastStorageError.current = message;
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [worksheet, ready, month]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      try { localStorage.setItem(STORAGE_PREFIX + worksheet.month_c, JSON.stringify(worksheet)); }
      catch (error) { console.error(`Monthly worksheet save on exit failed: ${error.message}`); }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [worksheet, ready]);

  const updateWorksheet = transform => setWorksheet(previous => transform(previous));
  const updateItem = (id, transform) => updateWorksheet(previous => ({
    ...previous,
    items_c: previous.items_c.map(item => String(item.Id) === String(id) ? transform(item) : item),
  }));
  const changeMonth = next => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next)) return;
    if (ready) {
      try {
        localStorage.setItem(STORAGE_PREFIX + worksheet.month_c, JSON.stringify(worksheet));
      } catch (error) {
        toast.error('The current month could not be saved. Export a copy before changing month.');
        console.error(`Monthly worksheet save before month change failed: ${error.message}`);
        return;
      }
    }
    setMonth(next);
  };
  const addItem = event => {
    event.preventDefault();
    if (!name.trim()) { toast.error('Enter an item name.'); nameInput.current?.focus(); return; }
    if (worksheet.items_c.some(item => item.Name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
      toast.error('This item already exists. Add batches to its existing row.');
      return;
    }
    updateWorksheet(previous => ({
      ...previous,
      items_c: [...previous.items_c, {
        Id: crypto.randomUUID(), Name: name.trim(), unit_c: unit,
        previous_c: [], received_c: [], expenditure_c: 0,
      }],
    }));
    setName('');
    toast.success('Item added.');
    nameInput.current?.focus();
  };
  const addBatch = (id, section, quantity, rate) => updateItem(id, item => ({
    ...item,
    [section]: [...item[section], {
      Id: crypto.randomUUID(), quantity_c: round2(quantity), rate_c: round2(rate),
    }],
  }));
  const removeBatch = (id, section, batchId) => updateItem(id, item => ({
    ...item, [section]: item[section].filter(batch => String(batch.Id) !== String(batchId)),
  }));
  const changeExpenditure = (id, value) => updateItem(id, item => ({ ...item, expenditure_c: round2(value) }));
  const deleteItem = id => {
    updateWorksheet(previous => ({
      ...previous, items_c: previous.items_c.filter(item => String(item.Id) !== String(id)),
    }));
    toast.success('Item deleted.');
  };
  const changeSummary = (key, value) => updateWorksheet(previous => ({ ...previous, [key]: round2(value) }));
  const addLedger = key => updateWorksheet(previous => ({
    ...previous,
    [key]: [...previous[key], { Id: crypto.randomUUID(), description_c: '', amount_c: 0 }],
  }));
  const editLedger = (key, id, field, value) => updateWorksheet(previous => ({
    ...previous,
    [key]: previous[key].map(row => String(row.Id) === String(id) ? { ...row, [field]: value } : row),
  }));
  const removeLedger = (key, id) => updateWorksheet(previous => ({
    ...previous, [key]: previous[key].filter(row => String(row.Id) !== String(id)),
  }));

  const previewCarryForward = () => {
    try {
      const targetMonth = nextMonth(worksheet.month_c);
      const raw = localStorage.getItem(STORAGE_PREFIX + targetMonth);
      const target = readWorksheet(targetMonth);
      const plan = buildCarryForward(worksheet, target.worksheet_c);
      setCarryPreview({
        ...plan, source_month_c: worksheet.month_c,
        restored_c: target.restored_c, target_raw_c: raw,
      });
    } catch (error) {
      toast.error(`Carry-forward preview unavailable: ${error.message}`);
      console.error(`Carry-forward preview failed: ${error.message}`);
    }
  };
  const confirmCarryForward = () => {
    if (!carryPreview) return;
    try {
      const targetMonth = carryPreview.worksheet_c.month_c;
      if (localStorage.getItem(STORAGE_PREFIX + targetMonth) !== carryPreview.target_raw_c) {
        setCarryPreview(null);
        throw new Error('The next-month worksheet changed after this preview. Open a new preview before confirming.');
      }
      localStorage.setItem(STORAGE_PREFIX + worksheet.month_c, JSON.stringify(worksheet));
      localStorage.setItem(STORAGE_PREFIX + targetMonth, JSON.stringify(carryPreview.worksheet_c));
      setCarryPreview(null);
      setMonth(targetMonth);
      toast.success(`Opening balances carried forward to ${monthLabel(targetMonth)}.`);
    } catch (error) {
      toast.error(`Carry-forward failed: ${error.message}`);
      console.error(`Monthly worksheet carry-forward failed: ${error.message}`);
    }
  };

  const runExport = async kind => {
    if (computed.overdraw_c || computed.fresh_balance_c < 0) {
      toast.error('Correct stock overdraw before exporting the summary.');
      return;
    }
    setExporting(kind);
    try {
      await new Promise(resolve => setTimeout(resolve, 30));
      if (kind === 'Excel') exportExcel(worksheet);
      else if (kind === 'PDF') exportPdf(worksheet);
      else exportCsv(worksheet);
      toast.success(`${kind} download prepared. Check your browser’s downloads.`);
    } catch (error) {
      toast.error(`${kind} export failed: ${error.message}`);
      console.error(`${kind} export failed: ${error.message}`);
    } finally {
      setExporting('');
    }
  };
  const retryRestore = () => {
    try {
      const result = readWorksheet(month);
      setWorksheet(result.worksheet_c);
      setRestored(result.restored_c);
      setRestoreError('');
      savedOnce.current = false;
      setReady(true);
    } catch (error) {
      setRestoreError(error.message);
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background text-[14px] text-foreground">
      <header className="print-header border-b border-border bg-background shadow-[var(--shadow-sm)]">
        <div className="border-b-4 border-warning bg-gradient-to-r from-primary to-secondary px-4 py-5 pr-44 md:px-7 md:py-6 md:pr-48">
          <p className="mb-2 text-[10px] font-semibold tracking-[0.08em] text-primary-foreground">सीमा सुरक्षा बल • BORDER SECURITY FORCE</p>
          <div className="flex items-start gap-3">
            <ApperIcon name="ClipboardList" className="mt-1 hidden h-7 w-7 shrink-0 text-primary-foreground md:block" />
            <div>
              <h1 className="print-heading font-heading text-lg font-semibold uppercase leading-tight tracking-tight text-primary-foreground md:text-[25px]">BSF Mess Summary Software</h1>
              <p className="mt-2 hidden text-xs text-primary-foreground/85 md:block">Monthly mess accounts at your fingertips</p>
            </div>
          </div>
        </div>
        <div className="no-print flex flex-col gap-3 bg-card px-4 py-3 xl:flex-row xl:items-end xl:justify-between md:px-7">
          <div className="space-y-2 xl:w-44">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="account-month">Account month</label>
            <Input id="account-month" type="month" value={month} onChange={event => changeMonth(event.target.value)} className="ledger-numeric h-10 rounded-sm border-input bg-background px-3 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/25" />
          </div>
          <form onSubmit={addItem} className="flex flex-1 flex-wrap items-end gap-2 xl:max-w-xl">
            <div className="min-w-36 flex-1 space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="new-item">New inventory item</label>
              <Input ref={nameInput} id="new-item" placeholder="e.g. Basmati rice" value={name} onChange={event => setName(event.target.value)} maxLength={100} disabled={!ready}
                className="h-10 rounded-sm border-input bg-background px-3 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/25" />
            </div>
            <div className="w-20 space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="new-unit">Unit</label>
              <select id="new-unit" value={unit} onChange={event => setUnit(event.target.value)} disabled={!ready}
                className="h-10 w-full rounded-sm border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {UNITS.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={!ready} className={`${controlButton} bg-primary text-primary-foreground hover:bg-primary/90`}>
              <ApperIcon name="Plus" className="mr-1 h-3 w-3" /> Add New Item
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={loading || !ready || Boolean(exporting)} onClick={previewCarryForward}
              className={`${controlButton} border-border bg-background text-foreground hover:border-primary hover:bg-accent active:scale-[0.98]`}>
              <ApperIcon name="ArrowRight" className="mr-1 h-3 w-3" /> Carry forward
            </Button>
            {['Excel', 'PDF', 'CSV'].map(kind => (
              <Button key={kind} type="button" variant="outline" disabled={loading || !ready || Boolean(exporting)} onClick={() => runExport(kind)}
                className={`${controlButton} border-border bg-background text-foreground hover:border-primary hover:bg-accent`}>
                <ApperIcon name={kind === 'Excel' ? 'FileSpreadsheet' : kind === 'PDF' ? 'FileText' : 'Download'} className="mr-1 h-3 w-3" />
                {exporting === kind ? 'Preparing…' : `Export ${kind}`}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="print-root mx-auto max-w-[1920px] space-y-6 px-4 py-4 md:px-7">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-l-4 border-primary bg-secondary px-4 py-3 text-xs">
          <p className="max-w-3xl leading-relaxed text-secondary-foreground"><strong>Working register.</strong> Figures calculate as you type. Edits are saved separately for each month on this browser only — export a copy for the official record. No account or server storage is used.</p>
          <span className={`flex items-center gap-1 font-semibold ${storageError ? 'text-destructive' : 'text-primary'}`} role="status">
            <ApperIcon name={storageError ? 'TriangleAlert' : 'HardDrive'} className="h-3 w-3" /> {saveStatus}
          </span>
        </div>
        {restored && <div className="no-print flex items-center justify-between gap-3 border border-success-border bg-success-muted px-4 py-3 text-sm text-success">
          <span><strong>{monthLabel(month)} restored.</strong> Your inventory and ledger entries are ready to continue.</span>
          <button type="button" aria-label="Dismiss restored worksheet banner" onClick={() => setRestored(false)} className="flex h-8 w-8 shrink-0 items-center justify-center hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ApperIcon name="X" className="h-4 w-4" /></button>
        </div>}
        {restoreError && <section role="alert" className="no-print border-l-4 border-destructive bg-destructive/10 p-4 text-sm">
          <h2 className="font-heading font-semibold text-destructive">Saved worksheet unavailable</h2>
          <p className="mt-2 text-destructive">{restoreError}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={retryRestore} variant="outline" className={`${controlButton} border-destructive text-destructive hover:bg-destructive/10`}>Retry restore</Button>
            <Button type="button" onClick={() => {
              setRestoreError('');
              setReady(true);
              savedOnce.current = false;
              toast('Working without the saved copy. Export before leaving this page.');
            }} variant="outline" className={`${controlButton} border-border hover:bg-muted`}>Use empty worksheet</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Using an empty worksheet may replace this month’s unreadable browser copy when you enter new figures.</p>
        </section>}
        {storageError && <p role="alert" className="no-print border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-destructive">{storageError}</p>}

        <section aria-labelledby="inventory-title" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{monthLabel(worksheet.month_c)} · Monthly closing register</p>
              <h2 id="inventory-title" className="mt-1 font-heading text-lg font-semibold">FIFO Inventory</h2>
            </div>
            <p className="text-xs text-muted-foreground">Qty in item units · Rates &amp; amounts in ₹ · Batches consumed in entry order</p>
          </div>
          <InventoryGrid computed={computed} onAddBatch={addBatch} onRemoveBatch={removeBatch} onExpenditure={changeExpenditure} onDelete={deleteItem} loading={loading} onFocusCreate={() => nameInput.current?.focus()} />
          {computed.overdraw_c && <p role="status" className="no-print flex items-center gap-2 text-xs font-semibold text-destructive">
            <ApperIcon name="TriangleAlert" className="h-4 w-4" /> Stock overdraw needs correction. FIFO expenditure is valued only against available stock.
          </p>}
        </section>

        <SummaryPanels worksheet={worksheet} computed={computed} onChange={changeSummary} />
        <FinancialLedgers worksheet={worksheet} computed={computed} onAdd={addLedger} onEdit={editLedger} onRemove={removeLedger} />
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>BsfMessSummary · Browser-local worksheet · Keep an exported copy with the monthly register.</p>
          <Button type="button" variant="outline" onClick={() => window.print()} className={`${controlButton} border-border hover:border-primary hover:bg-accent`}>
            <ApperIcon name="Printer" className="mr-2 h-4 w-4" /> Print ledger
          </Button>
        </div>
      </main>
      {carryPreview && <CarryForwardPreview preview={carryPreview} onClose={() => setCarryPreview(null)} onConfirm={confirmCarryForward} />}
      <footer className="no-print border-t-[3px] border-double border-primary bg-card pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-md)]">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-7">
          <div className="hidden text-xs text-muted-foreground md:block"><p className="font-semibold text-foreground">{monthLabel(worksheet.month_c)}</p><p>Live monthly closing figures</p></div>
          <div className="flex flex-1 items-center justify-between gap-5 md:flex-none md:gap-10">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Net amount</p><output className={`ledger-numeric text-base font-semibold md:text-xl ${computed.net_c < 0 ? 'text-destructive' : 'text-primary'}`}>₹ {money(computed.net_c)}</output></div>
            <div className="border-l border-border pl-5 md:pl-10"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Mess profit</p><output className={`ledger-numeric text-base font-semibold md:text-xl ${computed.profit_c < 0 ? 'text-destructive' : 'text-success'}`}>₹ {money(computed.profit_c)}</output></div>
          </div>
        </div>
      </footer>
    </div>
  );
}