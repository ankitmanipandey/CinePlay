import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MOVIX+</Text>
      <Text style={styles.subtitle}>Stream Unlimited Movies & Trailers</Text>
      <StatusBar style="light" />
    </View>
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