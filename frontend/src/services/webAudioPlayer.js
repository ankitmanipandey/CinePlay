import { useEffect, useState } from 'react';

export const RepeatMode = { Off: 0, Track: 1, Queue: 2 };
export const Event = { SleepTimerTriggered: 'sleep-timer-triggered' };
export const PlayerCommand = { PlayPause: 'PlayPause', Next: 'Next', Previous: 'Previous', Seek: 'Seek' };

const audio = typeof window !== 'undefined' ? new Audio() : null;
let state = { queue: [], index: -1, repeatMode: RepeatMode.Off, isPlaying: false, position: 0, duration: 0 };
const listeners = new Set();
const eventListeners = {};

function notify() { listeners.forEach((l) => l(state)); }
function emit(name, payload) { (eventListeners[name] || new Set()).forEach((cb) => cb(payload)); }
function setState(patch) { state = { ...state, ...patch }; notify(); }

let suppressPause = false;

function loadCurrentTrack(autoplay = true) {
    const track = state.queue[state.index];
    if (!audio || !track) return;

    if (autoplay) suppressPause = true; // load() may fire a fake 'pause' — ignore it

    audio.src = track.url;
    audio.load();

    if (autoplay) {
        audio.play()
            .then(() => { suppressPause = false; })
            .catch(() => {
                suppressPause = false;
                setState({ isPlaying: false }); // genuine autoplay failure — trust this one
            });
    } else {
        suppressPause = false;
    }
}

if (audio) {
    audio.addEventListener('timeupdate', () => setState({ position: audio.currentTime || 0 }));
    audio.addEventListener('durationchange', () => setState({ duration: audio.duration || 0 }));
    audio.addEventListener('play', () => setState({ isPlaying: true }));
    audio.addEventListener('pause', () => {
        if (suppressPause) return; // artifact of load(), not a real pause
        setState({ isPlaying: false });
    });
    audio.addEventListener('ended', () => {
        if (state.repeatMode === RepeatMode.Track) {
            audio.currentTime = 0;
            audio.play().catch(() => { });
            return;
        }
        webTrackPlayer.skipToNext();
    });
    audio.addEventListener('error', () => {
        console.warn('Web audio playback error on:', state.queue[state.index]?.url);
        emit('playback-error', { track: state.queue[state.index] });
        setState({ isPlaying: false });
        webTrackPlayer.skipToNext();
    });
}

let sleepTimerHandle = null;

const webTrackPlayer = {
    async setupPlayer() { return true; },
    async setCommands() { /* no lock-screen controls on web */ },
    registerBackgroundEventHandler() { /* no-op on web */ },
    async setMediaItems(items, startIndex = 0) {
        setState({ queue: items, index: startIndex });
        loadCurrentTrack(true);
    },
    async addMediaItems(items) { setState({ queue: [...state.queue, ...items] }); },
    async add(items) { return webTrackPlayer.addMediaItems(items); },
    async getQueue() { return state.queue; },
    async skipToIndex(i) {
        if (i < 0 || i >= state.queue.length) return;
        setState({ index: i });
        loadCurrentTrack(true);
    },
    async skipToNext() {
        if (state.queue.length === 0) return;
        let next = state.index + 1;
        if (next >= state.queue.length) {
            if (state.repeatMode === RepeatMode.Queue) next = 0;
            else { setState({ isPlaying: false }); return; }
        }
        await webTrackPlayer.skipToIndex(next);
    },
    async skipToPrevious() {
        if (state.queue.length === 0) return;
        const prev = state.index - 1;
        if (prev < 0) { if (audio) audio.currentTime = 0; return; }
        await webTrackPlayer.skipToIndex(prev);
    },
    async play() { if (audio) await audio.play().catch(() => { }); },
    async pause() { if (audio) audio.pause(); },
    async seekTo(seconds) { if (audio) audio.currentTime = seconds; },
    async setRepeatMode(mode) { setState({ repeatMode: mode }); },
    sleepAfterTime(seconds) {
        if (sleepTimerHandle) clearTimeout(sleepTimerHandle);
        sleepTimerHandle = setTimeout(() => {
            webTrackPlayer.pause();
            emit(Event.SleepTimerTriggered, {});
            sleepTimerHandle = null;
        }, seconds * 1000);
    },
    cancelSleepTimer() {
        if (sleepTimerHandle) { clearTimeout(sleepTimerHandle); sleepTimerHandle = null; }
    },
    addEventListener(eventName, cb) {
        if (!eventListeners[eventName]) eventListeners[eventName] = new Set();
        eventListeners[eventName].add(cb);
        return { remove: () => eventListeners[eventName].delete(cb) };
    },
};

export default webTrackPlayer;

function useStoreSlice(selector) {
    const [value, setValue] = useState(() => selector(state));
    useEffect(() => {
        const listener = (s) => setValue(selector(s));
        listeners.add(listener);
        return () => listeners.delete(listener);
    }, []);
    return value;
}

export function useActiveMediaItem() { return useStoreSlice((s) => s.queue[s.index] || null); }
export function useIsPlaying() { return { playing: useStoreSlice((s) => s.isPlaying), bufferingDuringPlay: false }; }
export function useProgress() {
    return { position: useStoreSlice((s) => s.position), duration: useStoreSlice((s) => s.duration), buffered: 0 };
}