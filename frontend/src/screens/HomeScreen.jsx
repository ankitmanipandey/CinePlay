import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const HomeScreen = () => {
    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={styles.container}>
                <Text style={styles.text}>Welcome to CinePlay!</Text>
            </SafeAreaView>
        </LinearGradient>
    )
}

export default HomeScreen

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: 'white', fontSize: 24, fontWeight: 'bold' }
})