import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobalSocket } from '../../store/useGlobalSocket';

// Custom Icon Component to handle the Hotstar-style Top Bar Gradient & Red Dot Badge
const TabIcon = ({ name, focused, color, size, showBadge = false }) => (
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

        {/* Real-time Unread Badge Red Dot */}
        {showBadge && <View style={styles.badgeDot} />}
    </View>
);

export default function TabLayout() {
    const unreadNotifsCount = useGlobalSocket((state) => state.unreadNotifsCount);
    // Fetch the safe area insets to account for system navigation bars
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: true,
                tabBarActiveTintColor: '#FFFFFF',
                tabBarInactiveTintColor: '#8F98A0',
                tabBarStyle: [
                    styles.tabBar,
                    {
                        // Dynamically add the bottom inset to ensure the tab bar sits above system buttons
                        height: (Platform.OS === 'ios' ? 88 : 65) + insets.bottom,
                        paddingBottom: (Platform.OS === 'ios' ? 30 : 10) + insets.bottom,
                    }
                ],
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
                        <TabIcon
                            name={focused ? 'happy' : 'happy-outline'}
                            focused={focused}
                            color={color}
                            size={24}
                            showBadge={unreadNotifsCount > 0}
                        />
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
        justify: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
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
    },
    badgeDot: {
        position: 'absolute',
        top: 2,
        right: '32%',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF007A',
        borderWidth: 1.5,
        borderColor: '#0A0A0C',
    },
});