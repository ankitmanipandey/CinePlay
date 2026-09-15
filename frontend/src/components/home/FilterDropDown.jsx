// src/components/home/FilterDropdown.jsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import ReAnimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export const FilterDropdown = ({ filters, setFilter, onClose }) => {
    const regionOptions = [{ l: 'All', v: 'all' }, { l: 'Indian', v: 'indian' }, { l: 'Others', v: 'others' }];
    const typeOptions = [{ l: 'All', v: 'all' }, { l: 'Movies', v: 'movie' }, { l: 'TV Shows / Web Series', v: 'tv' }, { l: 'Music', v: 'music' }, { l: 'Live Sports & TV', v: 'live' }];
    const langOptions = [{ l: 'Any', v: 'any' }, { l: 'Hindi', v: 'hi' }, { l: 'English', v: 'en' }, { l: 'Punjabi', v: 'pa' }, { l: 'Tamil', v: 'ta' }, { l: 'Others', v: 'others' }];
    const platformOptions = [{ l: 'Any', v: 'any' }, { l: 'Netflix', v: '8' }, { l: 'Prime Video', v: '119' }, { l: 'JioHotstar', v: '122|220|337' }, { l: 'SonyLIV', v: '237' }, { l: 'Zee5', v: '232' }];
    const liveOptions = [{ l: 'Cricket (Scores)', v: 'Cricket' }, { l: 'Football (Scores)', v: 'Football' }, { l: 'Basketball (Scores)', v: 'Basketball' }, { l: 'Live News', v: 'news' }, { l: 'Live Music', v: 'music' }, { l: 'Entertainment TV', v: 'entertainment' }, { l: 'Movies TV', v: 'movies' }];

    const renderGroup = (title, options, activeValue, filterKey) => (
        <ReAnimated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filterScroll}>
                {options.map(opt => {
                    const isActive = activeValue === opt.v;
                    return (
                        <TouchableOpacity
                            key={opt.v}
                            style={styles.filterChipContainer}
                            onPress={() => {
                                setFilter(filterKey, opt.v);
                                if (filterKey === 'type' && onClose) onClose();
                            }}
                            activeOpacity={0.8}
                        >
                            {isActive ? (
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterChipActive}>
                                    <Text style={styles.activeFilterText}>{opt.l}</Text>
                                </LinearGradient>
                            ) : (
                                <View style={styles.filterChipInactive}>
                                    <Text style={styles.filterText}>{opt.l}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </ReAnimated.View>
    );

    const activeLiveCategory = filters.liveCategory || 'Cricket';
    const isLiveSportsFeed = ['Cricket', 'Football', 'Basketball'].includes(activeLiveCategory);

    return (
        <ReAnimated.View layout={LinearTransition} style={styles.filterDropdownContainer}>
            {renderGroup("Category", typeOptions, filters.type, 'type')}
            {filters.type === 'live' ? (
                <>
                    {renderGroup("Live Feed", liveOptions, activeLiveCategory, 'liveCategory')}
                    {!isLiveSportsFeed && renderGroup("Language", langOptions, filters.language || 'any', 'language')}
                </>
            ) : filters.type === 'music' ? null : (
                <>
                    {renderGroup("Platform", platformOptions, filters.platform || 'any', 'platform')}
                    {renderGroup("Region", regionOptions, filters.region, 'region')}
                    {renderGroup("Language", langOptions, filters.language, 'language')}
                </>
            )}
        </ReAnimated.View>
    );
};

const styles = StyleSheet.create({
    filterDropdownContainer: { backgroundColor: 'rgba(20, 15, 30, 0.8)', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
    filterGroup: { marginBottom: 16 },
    filterGroupTitle: { color: '#808085', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8, letterSpacing: 1 },
    filterScroll: { paddingHorizontal: 16, gap: 10 },
    filterChipContainer: { borderRadius: 20, overflow: 'hidden' },
    filterChipActive: { paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
    filterChipInactive: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
    filterText: { color: '#A0A0A5', fontSize: 13, fontWeight: '600' },
    activeFilterText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
});