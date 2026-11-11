import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { fixed, numeric } from '@/lib/messWorksheet';

export default function LedgerNumber({ value, onChange, label, className, readOnly = false, form }) {
  const [draft, setDraft] = useState(fixed(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(fixed(value));
  }, [value, focused]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      aria-label={label}
      form={form}
      readOnly={readOnly}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={event => {
        const next = event.target.value;
        if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
        setDraft(next);
        onChange?.(numeric(next));
      }}
      onBlur={() => {
        setFocused(false);
        setDraft(fixed(numeric(draft)));
      }}
      className={cn(
        'ledger-numeric h-11 rounded-sm border-input bg-card px-2 text-right text-xs shadow-none transition-colors duration-[var(--transition-fast)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 md:h-8',
        readOnly && 'border-transparent bg-muted text-muted-foreground',
        className,
      )}
    />
  );
}