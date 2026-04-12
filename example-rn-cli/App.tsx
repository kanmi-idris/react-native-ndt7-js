import { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Ndt7, type Ndt7CompleteEvent, type Ndt7ErrorEvent, type Ndt7ProgressEvent, type SpeedTestState } from 'react-native-ndt7-js';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [state, setState] = useState<SpeedTestState>('idle');
  const [progress, setProgress] = useState<Ndt7ProgressEvent | null>(null);
  const [result, setResult] = useState<Ndt7CompleteEvent | null>(null);
  const [error, setError] = useState<Ndt7ErrorEvent | null>(null);

  useEffect(() => {
    const stateSub = Ndt7.addListener('stateChange', event => setState(event.state));
    const progressSub = Ndt7.addListener('progress', event => setProgress(event));
    const completeSub = Ndt7.addListener('complete', event => {
      setResult(event);
      setError(null);
    });
    const errorSub = Ndt7.addListener('error', event => setError(event));

    return () => {
      stateSub.remove();
      progressSub.remove();
      completeSub.remove();
      errorSub.remove();
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: safeAreaInsets.top + 24 }]}> 
      <Text style={styles.title}>react-native-ndt7-js / RN CLI</Text>
      <Text style={styles.line}>State: {state}</Text>
      <Text style={styles.line}>Phase: {progress?.phase ?? '-'}</Text>
      <Text style={styles.line}>Speed: {progress?.speedMbps?.toFixed(2) ?? '-'} Mbps</Text>
      <Text style={styles.line}>Download: {result?.downloadMbps?.toFixed(2) ?? '-'}</Text>
      <Text style={styles.line}>Upload: {result?.uploadMbps?.toFixed(2) ?? '-'}</Text>
      <Text style={styles.line}>Error: {error?.message ?? '-'}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={() => void Ndt7.startSpeedTest({ userAcceptedDataPolicy: true })}>
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={() => void Ndt7.stopSpeedTest()}>
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  line: {
    fontSize: 16,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
  },
  stopButton: {
    backgroundColor: '#b91c1c',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default App;
