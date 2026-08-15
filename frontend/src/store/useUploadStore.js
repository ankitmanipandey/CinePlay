import { create } from 'zustand';

export const useUploadStore = create((set) => ({
    activeUpload: null, // Stores { uri, title, progress }
    setActiveUpload: (upload) => set({ activeUpload: upload }),
    updateProgress: (progress) =>
        set((state) => state.activeUpload ? { activeUpload: { ...state.activeUpload, progress } } : state),
    clearActiveUpload: () => set({ activeUpload: null }),
}));