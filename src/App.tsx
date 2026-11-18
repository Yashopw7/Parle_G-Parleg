/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardPage } from './components/DashboardPage';
import { PublicCardPage } from './components/PublicCardPage';
import { SetupCardPage } from './components/SetupCardPage';

function parseRoute(pathname: string):
  | { view: 'home' }
  | { view: 'public'; cardId: string }
  | { view: 'setup'; cardId: string } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const publicMatch = clean.match(/^\/c\/([^/]+)$/);
  if (publicMatch) {
    return { view: 'public', cardId: decodeURIComponent(publicMatch[1]) };
  }
  const setupMatch = clean.match(/^\/setup\/([^/]+)$/);
  if (setupMatch) {
    return { view: 'setup', cardId: decodeURIComponent(setupMatch[1]) };
  }
  return { view: 'home' };
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handlePop = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (nextPath === window.location.pathname) return;
    window.history.pushState({}, '', nextPath);
    setPathname(nextPath);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const route = parseRoute(pathname);

  return (
    <ErrorBoundary>
      {route.view === 'public' && (
        <PublicCardPage cardId={route.cardId} user={user} onNavigate={navigate} />
      )}
      {route.view === 'setup' && (
        <SetupCardPage
          cardId={route.cardId}
          user={user}
          authReady={authReady}
          onNavigate={navigate}
        />
      )}
      {route.view === 'home' && (
        <DashboardPage user={user} authReady={authReady} onNavigate={navigate} />
      )}
    </ErrorBoundary>
  );
}
