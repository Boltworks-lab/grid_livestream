import { useAuth } from './auth/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';

export function App() {
  const { user, restoring } = useAuth();
  if (restoring) return <main className="auth-wrap" aria-busy="true" />;
  return user ? <HomeScreen /> : <AuthScreen />;
}
