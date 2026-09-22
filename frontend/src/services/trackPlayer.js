import { Platform } from 'react-native';

let mod;
if (Platform.OS === 'web') {
    mod = require('./webAudioPlayer');
} else {
    mod = require('@rntp/player');
}

export default mod.default;
export const useActiveMediaItem = mod.useActiveMediaItem;
export const useIsPlaying = mod.useIsPlaying;
export const useProgress = mod.useProgress;
export const RepeatMode = mod.RepeatMode;
export const Event = mod.Event;
export const PlayerCommand = mod.PlayerCommand;