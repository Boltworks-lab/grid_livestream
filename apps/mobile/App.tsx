import { PLATFORM_FEES } from '@grid/shared';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grid</Text>
      <Text style={styles.subtitle}>
        Mobile app shell — Phase 0. Product screens arrive from Phase 2 onward.
      </Text>
      <Text style={styles.meta}>
        Workspace link check — gift fee from @grid/shared: {PLATFORM_FEES.gift * 100}%
      </Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    color: '#f5f5f7',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#f5f5f7',
    textAlign: 'center',
  },
  meta: {
    color: '#8e8e99',
    fontSize: 12,
    textAlign: 'center',
  },
});
