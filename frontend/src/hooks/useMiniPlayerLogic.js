import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { RepeatMode } from '@rntp/player';

export const useMiniPlayerLogic = ({
    loopMode, handlePrevTrack, handleNextTrack, onOpenModal, onDismiss, onTogglePlay
}) => {

    // Safe loop checks
    const isLoopActive = loopMode !== 0 && loopMode !== 'off' && !!loopMode;
    const isLoopOne = loopMode === 1 || loopMode === 'track' || loopMode === 'one' || loopMode === RepeatMode.Track;

    // Mobile Swipe Gestures (Skip / Open / Dismiss)
    const panGesture = useMemo(() => Gesture.Pan()
        .activeOffsetX([-10, 10])
        .activeOffsetY([-15, 15])
        .onEnd((e) => {
            const { translationX: dx, translationY: dy, velocityX: vx, velocityY: vy } = e;
            if (dx > 50 || vx > 800) runOnJS(handlePrevTrack)();
            else if (dx < -50 || vx < -800) runOnJS(handleNextTrack)();
            else if (dy < -40 || vy < -800) runOnJS(onOpenModal)();
            else if (dy > 40 || vy > 800) runOnJS(onDismiss)();
        }), [handlePrevTrack, handleNextTrack, onOpenModal, onDismiss]);

    // Mobile Tap Gestures (Play/Pause vs Open Fullscreen)
    const tapGesture = useMemo(() => {
        const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(250).onEnd((_, success) => {
            if (success) runOnJS(onTogglePlay)();
        });
        const singleTap = Gesture.Tap().numberOfTaps(1).maxDuration(250).onEnd((_, success) => {
            if (success) runOnJS(onOpenModal)();
        });
        return Gesture.Exclusive(doubleTap, singleTap);
    }, [onTogglePlay, onOpenModal]);

    return {
        isLoopActive,
        isLoopOne,
        panGesture,
        tapGesture
    };
};