import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { sdk } from '@/services/sdk';
import { setUser, clearUser, setInitialized } from '@/store/userSlice';
import { verifyRouteAccess } from '@/router/route.utils';
import { APP_CONFIG, GENERIC_AUTH } from '@/config/app.config';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within RootLayout');
  return ctx;
}

const AUTH_PAGE_SUFFIXES = ['/login', '/signup', '/callback', '/forgot-password', '/reset-password', '/verify-email', '/accept-invite'];
const isAuthPage = (pathname) => AUTH_PAGE_SUFFIXES.some((s) => pathname === s || pathname.endsWith(s));

export default function RootLayout() {
  const dispatch = useDispatch();
  const { user, isAuthenticated, isInitialized } = useSelector((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const hasInitRef = useRef(false);

  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;

    let isMounted = true;
    const init = async () => {
      try {
        const currentUser = sdk.session.user();
        if (!isMounted) return;
        if (currentUser) {
          dispatch(setUser(currentUser));
          handlePostAuthNavigation();
        } else {
          dispatch(setInitialized());
        }
      } catch {
        if (isMounted) dispatch(setInitialized());
      }
    };
    init();

    const unsub = sdk.session.subscribe((state) => {
      if (state.status === 'authenticated' && state.user) {
        dispatch(setUser(state.user));
        handlePostAuthNavigation();
      } else {
        dispatch(clearUser());
      }
    });

    return () => { isMounted = false; unsub(); };
  }, [dispatch]);

  function handlePostAuthNavigation() {
    const params = new URLSearchParams(window.location.search);
    const redirectPath = params.get('redirect');
    if (redirectPath) {
      navigateRef.current(redirectPath, { replace: true });
    } else {
      const isOnAuthPage = isAuthPage(window.location.pathname);
      if (isOnAuthPage) {
        navigateRef.current(GENERIC_AUTH.redirectAfterAuth || '/', { replace: true });
      }
    }
  }

  const deepestMatch = matches[matches.length - 1];
  const accessRule = deepestMatch?.handle?.access ?? 'public';
  const isPublicRoute = !accessRule || accessRule === 'public';
  const hasAccess = isPublicRoute || (isInitialized && verifyRouteAccess(accessRule, user));

  useEffect(() => {
    if (!isInitialized || hasAccess) return;
    const loginRoute = APP_CONFIG.defaultLoginRoute ?? '/login';
    if (user) {
      navigateRef.current('/access-denied', { replace: true });
    } else {
      const currentPath = location.pathname + location.search;
      navigateRef.current(`${loginRoute}?redirect=${encodeURIComponent(currentPath)}`, { replace: true });
    }
  }, [location.pathname, isInitialized, hasAccess, user]);

  const handleLogout = useCallback(async () => {
    await sdk.session.logout();
    dispatch(clearUser());
    navigateRef.current(APP_CONFIG.defaultLoginRoute ?? '/login', { replace: true });
  }, [dispatch]);

  if (!hasAccess) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connecting…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ logout: handleLogout, user, isAuthenticated }}>
      <ErrorBoundary fullPage>
        <Outlet />
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}
