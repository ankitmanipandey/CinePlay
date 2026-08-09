import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const toastConfig = {
  hotstarSuccess: ({ text1 }) => (
    <View style={styles.toastWrapper}>
      <LinearGradient
        colors={['#1F80E0', '#D63484']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastContainer}
      >
        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        <Text style={styles.toastText}>{text1}</Text>
      </LinearGradient>
    </View>
  )
};

export default function RootLayout() {
  return (
    // Wrap the Stack in a dark View to act as the background canvas
    <View style={{ flex: 1, backgroundColor: '#0A0A0C' }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0A0C' },
          animation: 'slide_from_right'
        }}
      />
      {/* Toast sits outside so it floats over everything */}
      <Toast config={toastConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  }
});