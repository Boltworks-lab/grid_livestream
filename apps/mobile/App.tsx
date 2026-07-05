import { color } from '@grid/ui-tokens';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import type { RootStackParamList } from './src/navigation';
import { AuthScreen } from './src/screens/AuthScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { GoLiveScreen } from './src/screens/GoLiveScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LiveRoomScreen } from './src/screens/LiveRoomScreen';
import { WalletScreen } from './src/screens/WalletScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: color.bg0,
    card: color.bg1,
    primary: color.purple2,
    text: color.t1,
    border: 'rgba(255,255,255,0.07)',
  },
};

function tabIcon(glyph: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: color.purple2,
        tabBarInactiveTintColor: color.t3,
        tabBarStyle: { backgroundColor: color.bg1, borderTopColor: 'rgba(255,255,255,0.07)' },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ tabBarIcon: tabIcon('🏠') }}
      />
      <Tab.Screen name="Go Live" component={GoLiveScreen} options={{ tabBarIcon: tabIcon('🔴') }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarIcon: tabIcon('💎') }} />
      <Tab.Screen name="Me" component={HomeScreen} options={{ tabBarIcon: tabIcon('👤') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, restoring } = useAuth();
  if (restoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.purple} />
      </View>
    );
  }
  if (!user) return <AuthScreen />;
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="LiveRoom" component={LiveRoomScreen} options={{ animation: 'fade' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
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
