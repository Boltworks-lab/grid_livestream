import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { api } from './lib/api';
import { AuthScreen } from './screens/AuthScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { GoLiveScreen } from './screens/GoLiveScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LiveRoomScreen } from './screens/LiveRoomScreen';

function NavBar() {
  const { user, logout } = useAuth();
  const [diamonds, setDiamonds] = useState<number | null>(null);

  useEffect(() => {
    void api.GET('/wallet').then(({ data }) => data && setDiamonds(data.diamonds));
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
        <NavLink to="/me">Me</NavLink>
      </nav>
      <div className="nav-right">
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
        <Route path="/me" element={<HomeScreen />} />
        <Route path="*" element={<DiscoverScreen />} />
      </Routes>
    </>
  );
}
