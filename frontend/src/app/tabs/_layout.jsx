import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Custom Icon Component to handle the Hotstar-style Top Bar Gradient
const TabIcon = ({ name, focused, color, size }) => (
    <View style={styles.iconContainer}>
        {/* The JioHotstar Style Gradient Top Bar */}
        {focused && (
            <LinearGradient
                colors={['#00E5FF', '#9B51E0', '#FF007A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeTopBar}
            />
        )}
        <Ionicons
            name={name}
            size={size}
            // Uses pure white when focused, gray when inactive
            color={focused ? '#FFFFFF' : color}
            style={{ marginTop: focused ? 2 : 0 }} // Slight nudge when the top bar is active
        />
    </View>
);

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: true,
                tabBarActiveTintColor: '#FFFFFF',
                tabBarInactiveTintColor: '#8F98A0',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabBarLabel,
                sceneContainerStyle: { backgroundColor: '#0A0A0C' },
            }}
        >
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Search',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} color={color} size={22} />
                    ),
                }}
            />

            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} size={22} />
                    ),
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    title: 'My Space',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name={focused ? 'happy' : 'happy-outline'} focused={focused} color={color} size={24} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#0A0A0C',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)', // Very subtle border line
        height: Platform.OS === 'ios' ? 88 : 65,
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        paddingTop: 8,
        elevation: 0,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    tabBarLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'relative'
    },
    activeTopBar: {
        position: 'absolute',
        top: -8, // Perfectly counters the paddingTop: 8 of the tabBar to sit on the top border
        width: 46, // Width of the gradient indicator
        height: 3,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,

        // Neon glow effect for the gradient line
        shadowColor: '#9B51E0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
        elevation: 6,
    }
});