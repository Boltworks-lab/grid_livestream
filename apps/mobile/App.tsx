import { color } from '@grid/ui-tokens';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';

function Root() {
  const { user, restoring } = useAuth();
  if (restoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.purple} />
      </View>
    );
  }
  return user ? <HomeScreen /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: color.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
