import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, useWindowDimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useCineBuddiesLogic } from '../hooks/useCineBuddiesLogic';

export default function CineBuddiesScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        router, activeTab, setActiveTab, friends, isLoadingFriends, discoverData,
        isLoadingDiscover, searchQuery, setSearchQuery, searchResults, isSearching,
        handleManualSubmit, sendRequest, unfriendUser, handleRequestAction,
        handleOpenChat, getUserStatus
    } = useCineBuddiesLogic();

    const renderDynamicButton = (item, status) => {
        switch (status) {
            case 'friend':
                return (
                    <TouchableOpacity style={[styles.actionBtn, styles.unfriendBtn]} onPress={() => unfriendUser(item)}>
                        <Ionicons name="person-remove" size={16} color="#E53935" />
                        <Text style={[styles.btnText, { color: '#E53935' }]}>Unfriend</Text>
                    </TouchableOpacity>
                );
            case 'sent':
                return (
                    <View style={[styles.actionBtn, styles.sentBtn]}>
                        <Ionicons name="checkmark-done" size={16} color="#B3B3B3" />
                        <Text style={[styles.btnText, { color: '#B3B3B3' }]}>Sent</Text>
                    </View>
                );
            case 'received':
                return (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.iconBtnAccept} onPress={() => handleRequestAction('accept', item)}>
                            <Ionicons name="checkmark" size={20} color="#00E676" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtnReject} onPress={() => handleRequestAction('reject', item)}>
                            <Ionicons name="close" size={20} color="#E53935" />
                        </TouchableOpacity>
                    </View>
                );
            default:
                return (
                    <TouchableOpacity style={[styles.actionBtn, styles.addBtn]} onPress={() => sendRequest(item)}>
                        <Ionicons name="person-add" size={16} color="#00E5FF" />
                        <Text style={[styles.btnText, { color: '#00E5FF' }]}>Add</Text>
                    </TouchableOpacity>
                );
        }
    };

    const renderUserItem = ({ item }) => {
        const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
        const status = getUserStatus(item._id);
        const cardStyle = isDesktop ? [styles.userCard, styles.desktopCard] : styles.userCard;

        return (
            <View style={cardStyle}>
                <View style={[styles.avatar, { backgroundColor: '#2A2A30' }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email || 'CineBuddy User'}</Text>
                </View>
                {renderDynamicButton(item, status)}
            </View>
        );
    };

    const renderFriendChat = ({ item }) => {
        const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
        const cardStyle = isDesktop ? [styles.userCard, styles.desktopCard] : styles.userCard;

        return (
            <TouchableOpacity style={cardStyle} onPress={() => handleOpenChat(item._id)}>
                <View style={styles.avatarWrapper}>
                    <LinearGradient colors={['#9B51E0', '#FF007A']} style={styles.avatar}>
                        <Text style={styles.avatarText}>{initial}</Text>
                    </LinearGradient>
                    {item.isOnline && <View style={styles.onlineIndicator} />}
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={[styles.userEmail, item.isOnline && { color: '#00E676' }]}>
                        {item.isOnline ? 'Online' : 'Tap to chat'}
                    </Text>
                </View>
                {item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                    </View>
                ) : (
                    <Ionicons name="chatbubble-ellipses" size={20} color="#8F98A0" />
                )}
            </TouchableOpacity>
        );
    };

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Grid Widescreen)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.desktopWrapper}>
                    <View style={styles.headerDesktop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButtonDesktop}>
                                <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitleDesktop}>CineBuddies</Text>
                        </View>
                        <View style={styles.tabContainerDesktop}>
                            <TouchableOpacity style={[styles.tabDesktop, activeTab === 'chats' && styles.activeTab]} onPress={() => setActiveTab('chats')}>
                                <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>Chats</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.tabDesktop, activeTab === 'discover' && styles.activeTab]} onPress={() => setActiveTab('discover')}>
                                <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>Discover</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {activeTab === 'chats' ? (
                        isLoadingFriends ? (
                            <ActivityIndicator size="large" color="#9B51E0" style={{ marginTop: 100 }} />
                        ) : (
                            <ScrollView contentContainerStyle={styles.desktopGrid} showsVerticalScrollIndicator={false}>
                                {friends.length === 0 ? (
                                    <Text style={styles.emptyTextDesktop}>You have no CineBuddies yet. Go to Discover to find friends!</Text>
                                ) : (
                                    friends.map((item) => <React.Fragment key={item._id}>{renderFriendChat({ item })}</React.Fragment>)
                                )}
                            </ScrollView>
                        )
                    ) : (
                        <View style={styles.discoverContainerDesktop}>
                            <View style={styles.searchBoxDesktop}>
                                <Ionicons name="search" size={22} color="#8F98A0" />
                                <TextInput
                                    style={styles.searchInputDesktop}
                                    placeholder="Search by name or email..."
                                    placeholderTextColor="#8F98A0"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    onSubmitEditing={handleManualSubmit}
                                    returnKeyType="search"
                                    autoCapitalize="none"
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                                        <Ionicons name="close-circle" size={22} color="#8F98A0" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {isSearching || isLoadingDiscover ? (
                                <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 100 }} />
                            ) : searchQuery ? (
                                <ScrollView contentContainerStyle={styles.desktopGrid} showsVerticalScrollIndicator={false}>
                                    {searchResults.length === 0 ? (
                                        <Text style={styles.emptyTextDesktop}>No users found.</Text>
                                    ) : (
                                        searchResults.map((item) => <React.Fragment key={item._id}>{renderUserItem({ item })}</React.Fragment>)
                                    )}
                                </ScrollView>
                            ) : (
                                <ScrollView contentContainerStyle={styles.desktopScrollSections} showsVerticalScrollIndicator={false}>
                                    {discoverData.received.length > 0 && (
                                        <View style={styles.desktopSection}>
                                            <Text style={styles.sectionHeaderDesktop}>Received Requests</Text>
                                            <View style={styles.desktopGrid}>
                                                {discoverData.received.map(item => <React.Fragment key={item._id}>{renderUserItem({ item })}</React.Fragment>)}
                                            </View>
                                        </View>
                                    )}
                                    {discoverData.sent.length > 0 && (
                                        <View style={styles.desktopSection}>
                                            <Text style={styles.sectionHeaderDesktop}>Sent Requests</Text>
                                            <View style={styles.desktopGrid}>
                                                {discoverData.sent.map(item => <React.Fragment key={item._id}>{renderUserItem({ item })}</React.Fragment>)}
                                            </View>
                                        </View>
                                    )}
                                    {discoverData.friends.length > 0 && (
                                        <View style={styles.desktopSection}>
                                            <Text style={styles.sectionHeaderDesktop}>Your Friends</Text>
                                            <View style={styles.desktopGrid}>
                                                {discoverData.friends.map(item => <React.Fragment key={item._id}>{renderUserItem({ item })}</React.Fragment>)}
                                            </View>
                                        </View>
                                    )}
                                    {discoverData.received.length === 0 && discoverData.sent.length === 0 && discoverData.friends.length === 0 && (
                                        <Text style={styles.emptyTextDesktop}>No recent activity. Search for users to add them!</Text>
                                    )}
                                </ScrollView>
                            )}
                        </View>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>CineBuddies</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'chats' && styles.activeTab]} onPress={() => setActiveTab('chats')}>
                    <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>Chats</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'discover' && styles.activeTab]} onPress={() => setActiveTab('discover')}>
                    <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>Discover</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'chats' ? (
                isLoadingFriends ? (
                    <ActivityIndicator size="large" color="#9B51E0" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={friends}
                        keyExtractor={item => item._id}
                        renderItem={renderFriendChat}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>You have no CineBuddies yet. Go to Discover to find friends!</Text>}
                    />
                )
            ) : (
                <View style={styles.discoverContainer}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={20} color="#8F98A0" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or email..."
                            placeholderTextColor="#8F98A0"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleManualSubmit}
                            returnKeyType="search"
                            autoCapitalize="none"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                                <Ionicons name="close-circle" size={20} color="#8F98A0" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isSearching || isLoadingDiscover ? (
                        <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
                    ) : searchQuery ? (
                        <FlatList
                            data={searchResults}
                            keyExtractor={item => item._id}
                            renderItem={renderUserItem}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
                        />
                    ) : (
                        <FlatList
                            data={[
                                ...(discoverData.received.length ? [{ isHeader: true, title: 'Received Requests' }, ...discoverData.received] : []),
                                ...(discoverData.sent.length ? [{ isHeader: true, title: 'Sent Requests' }, ...discoverData.sent] : []),
                                ...(discoverData.friends.length ? [{ isHeader: true, title: 'Your Friends' }, ...discoverData.friends] : [])
                            ]}
                            keyExtractor={(item, index) => item.isHeader ? item.title : item._id}
                            renderItem={({ item }) => {
                                if (item.isHeader) return <Text style={styles.sectionHeader}>{item.title}</Text>;
                                return renderUserItem({ item });
                            }}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={<Text style={styles.emptyText}>No recent activity. Search for users to add them!</Text>}
                        />
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },

    // --- DESKTOP STYLES (>= 1024px) ---
    desktopWrapper: { flex: 1, width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 24 },
    headerDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    backButtonDesktop: { marginRight: 24, cursor: 'pointer' },
    headerTitleDesktop: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold' },
    tabContainerDesktop: { flexDirection: 'row', backgroundColor: '#17171C', borderRadius: 12, padding: 6, width: 300 },
    tabDesktop: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, cursor: 'pointer' },
    desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingBottom: 40 },
    desktopCard: { width: 310, marginBottom: 0 },
    emptyTextDesktop: { color: '#8F98A0', textAlign: 'center', width: '100%', marginTop: 60, fontSize: 18 },
    discoverContainerDesktop: { flex: 1 },
    searchBoxDesktop: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', paddingHorizontal: 20, height: 60, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 32, maxWidth: 600, alignSelf: 'center', width: '100%' },
    searchInputDesktop: { flex: 1, color: '#FFF', fontSize: 16, marginHorizontal: 12, outlineStyle: 'none' },
    desktopScrollSections: { paddingBottom: 60 },
    desktopSection: { marginBottom: 32 },
    sectionHeaderDesktop: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    backButton: { marginRight: 16, cursor: 'pointer' },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
    tabContainer: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#17171C', borderRadius: 8, padding: 4, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6, cursor: 'pointer' },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    emptyText: { color: '#8F98A0', textAlign: 'center', marginTop: 40, fontSize: 15, paddingHorizontal: 20 },
    sectionHeader: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, marginLeft: 4 },
    discoverContainer: { flex: 1 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', marginHorizontal: 16, paddingHorizontal: 16, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 8 },
    searchInput: { flex: 1, color: '#FFF', fontSize: 15, marginHorizontal: 10, outlineStyle: 'none' },

    // --- SHARED STYLES ---
    activeTab: { backgroundColor: '#2A2A30' },
    tabText: { color: '#8F98A0', fontWeight: '600', fontSize: 14 },
    activeTabText: { color: '#FFFFFF' },
    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', cursor: 'pointer' },
    avatarWrapper: { position: 'relative', marginRight: 14 },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    onlineIndicator: { position: 'absolute', bottom: -2, right: 10, width: 14, height: 14, borderRadius: 7, backgroundColor: '#00E676', borderWidth: 2.5, borderColor: '#17171C' },
    userInfo: { flex: 1 },
    userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    userEmail: { color: '#8F98A0', fontSize: 13 },
    unreadBadge: { backgroundColor: '#00E5FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
    unreadBadgeText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 6, cursor: 'pointer' },
    addBtn: { backgroundColor: 'rgba(0, 229, 255, 0.1)', borderColor: 'rgba(0, 229, 255, 0.3)' },
    unfriendBtn: { backgroundColor: 'rgba(229, 57, 53, 0.1)', borderColor: 'rgba(229, 57, 53, 0.3)' },
    sentBtn: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', cursor: 'default' },
    btnText: { fontWeight: 'bold', fontSize: 13 },
    actionRow: { flexDirection: 'row', gap: 8 },
    iconBtnAccept: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 230, 118, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.3)', cursor: 'pointer' },
    iconBtnReject: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(229, 57, 53, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(229, 57, 53, 0.3)', cursor: 'pointer' }
});