import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { APP_CONFIG } from '@/config/app.config';
import { Box, Menu } from 'lucide-react';
import ApperIcon from '@/components/ApperIcon';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useOwnerLayoutData } from '@/hooks/useOwnerLayoutData';

const NavItem = ({ to, icon, label, count }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )
    }
  >
    <ApperIcon name={icon} size={18} className="shrink-0" />
    <span className="truncate">{label}</span>
    {count > 0 && (
      <span className="ml-auto shrink-0 text-xs font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
        {count}
      </span>
    )}
  </NavLink>
);

// The app name + icon, linking to the signed-in landing route.
const BrandLink = ({ to, onNavigate, className, boxClass, iconClass }) => (
  <Link
    to={to}
    onClick={onNavigate}
    aria-label={`${APP_CONFIG.name} home`}
    className={cn(
      'flex items-center min-w-0 rounded-lg transition-opacity hover:opacity-80',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className
    )}
  >
    <div className={cn('bg-primary/10 flex items-center justify-center shrink-0', boxClass)}>
      <Box className={cn('text-primary', iconClass)} />
    </div>
    <span className="text-lg font-semibold truncate">{APP_CONFIG.name}</span>
  </Link>
);

export default function OwnerLayout() {
  const { homeRoute, navGroups, footerPages, counts } = useOwnerLayoutData();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-50 lg:hidden"
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setSidebarOpen(false); }}
        />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 bg-card border-r flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 w-(--spacing-sidebar)',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center px-5 h-(--spacing-header) border-b shrink-0">
          <BrandLink
            to={homeRoute}
            onNavigate={() => setSidebarOpen(false)}
            className="gap-3"
            boxClass="size-8 rounded-lg"
            iconClass="size-4"
          />
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`} className={gi > 0 ? 'mt-4' : ''}>
              {group.label && (
                <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} count={counts[item.to]} />
                ))}
              </div>
            </div>
          ))}
          {footerPages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              {footerPages.map((page) => (
                <NavItem key={page.path} to={page.path} icon={page.icon ?? 'CircleDot'} label={page.label ?? page.path.replace('/', '')} />
              ))}
            </div>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-(--spacing-header) flex items-center gap-3 px-4 border-b bg-card lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <Menu className="size-5" />
          </button>
          <BrandLink to={homeRoute} className="gap-2" boxClass="size-6 rounded-md" iconClass="size-3.5" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
