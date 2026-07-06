import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { api } from './lib/api';
import { AuthScreen } from './screens/AuthScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { GoLiveScreen } from './screens/GoLiveScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InboxScreen } from './screens/InboxScreen';
import { LiveRoomScreen } from './screens/LiveRoomScreen';

function NavBar() {
  const { user, logout } = useAuth();
  const [diamonds, setDiamonds] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () =>
      void api.GET('/wallet').then(({ data }) => data && setDiamonds(data.diamonds));
    load();
    window.addEventListener('grid:wallet-changed', load);
    return () => window.removeEventListener('grid:wallet-changed', load);
  }, []);

  useEffect(() => {
    const poll = () =>
      void api.GET('/notifications').then(({ data }) => data && setUnread(data.unread));
    poll();
    const timer = setInterval(poll, 20_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="topnav">
      <Link to="/" className="brand small">
        <span className="brand-mark">▶</span>
        <b>Grid</b>
      </Link>
      <nav className="nav-links">
        <NavLink to="/" end>
          Discover
        </NavLink>
        <NavLink to="/inbox">Inbox</NavLink>
        <NavLink to="/me">Me</NavLink>
      </nav>
      <div className="nav-right">
        <Link to="/inbox" className="bell" title="Inbox">
          🔔{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
        </Link>
        <Link to="/me" className="bal-pill" title="Wallet">
          💎 <b>{diamonds === null ? '—' : diamonds.toLocaleString()}</b>
        </Link>
        <Link to="/go-live" className="golive-btn">
          Go live
        </Link>
        <span className="handle">@{user?.handle}</span>
        <button type="button" className="ghost-btn" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </header>
  );
}

export function App() {
  const { user, restoring } = useAuth();
  if (restoring) return <main className="auth-wrap" aria-busy="true" />;
  if (!user) return <AuthScreen />;
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<DiscoverScreen />} />
        <Route path="/stream/:id" element={<LiveRoomScreen />} />
        <Route path="/go-live" element={<GoLiveScreen />} />
        <Route path="/inbox" element={<InboxScreen />} />
        <Route path="/me" element={<HomeScreen />} />
        <Route path="*" element={<DiscoverScreen />} />
      </Routes>
    </>
  );
}
