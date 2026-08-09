import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <LoginScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#E50914',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#CCCCCC',
    fontSize: 14,
    marginTop: 8,
  },
});