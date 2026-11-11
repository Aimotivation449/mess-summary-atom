import { Outlet } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';

export default function PublicLayout() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="no-print absolute right-3 top-5 z-[46] rounded-sm border border-border bg-card p-1 shadow-[var(--shadow-sm)] md:right-7 md:top-7">
        <ThemeToggle className="justify-between" />
      </div>
      <Outlet />
    </div>
  );
}