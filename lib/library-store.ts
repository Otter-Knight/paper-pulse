import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PaperZone = "deep" | "quick" | "read"; // 精读区 | 速读区 | 已读完

export interface SavedPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  source: "arxiv" | "openreview";
  sourceUrl: string;
  pdfUrl: string;
  tags: string[];
  highlights: string[];
  publishedAt: string;
  savedAt: string;
  zone: PaperZone;
  notes: PaperNote[];
  stars: number; // 1-5 stars rating
  isRead: boolean; // 已读完标记
  readAt?: string; // 读完时间
  noRecommend: boolean; // 不再推荐
}

export interface PaperNote {
  id: string;
  content: string;
  position: "beginning" | "end" | "side";
  color: string;
  createdAt: string;
}

interface LibraryStore {
  savedPapers: SavedPaper[];
  addToLibrary: (paper: Omit<SavedPaper, "savedAt" | "notes" | "zone" | "stars" | "isRead" | "noRecommend">, zone?: PaperZone) => void;
  removeFromLibrary: (paperId: string) => void;
  moveToZone: (paperId: string, zone: PaperZone) => void;
  setStars: (paperId: string, stars: number) => void;
  markAsRead: (paperId: string, zone?: PaperZone) => void;
  setNoRecommend: (paperId: string) => void;
  addNote: (paperId: string, note: Omit<PaperNote, "id" | "createdAt">) => void;
  updateNote: (paperId: string, noteId: string, content: string) => void;
  deleteNote: (paperId: string, noteId: string) => void;
  isInLibrary: (paperId: string) => boolean;
  isInZone: (paperId: string, zone: PaperZone) => boolean;
  getPaperById: (paperId: string) => SavedPaper | undefined;
  getPapersByZone: (zone: PaperZone) => SavedPaper[];
  isRead: (paperId: string) => boolean;
  isNoRecommend: (paperId: string) => boolean;
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      savedPapers: [],

      addToLibrary: (paper, zone = "deep") => {
        set((state) => ({
          savedPapers: [
            {
              ...paper,
              savedAt: new Date().toISOString(),
              zone,
              notes: [],
              stars: 0,
              isRead: false,
              noRecommend: false,
            },
            ...state.savedPapers,
          ],
        }));
      },

      removeFromLibrary: (paperId) => {
        set((state) => ({
          savedPapers: state.savedPapers.filter((p) => p.id !== paperId),
        }));
      },

      moveToZone: (paperId, zone) => {
        set((state) => ({
          savedPapers: state.savedPapers.map((p) =>
            p.id === paperId ? { ...p, zone } : p
          ),
        }));
      },

      setStars: (paperId, stars) => {
        set((state) => ({
          savedPapers: state.savedPapers.map((p) =>
            p.id === paperId ? { ...p, stars: Math.min(5, Math.max(0, stars)) } : p
          ),
        }));
      },

      markAsRead: (paperId, zone = "read") => {
        set((state) => ({
          savedPapers: state.savedPapers.map((p) =>
            p.id === paperId ? { ...p, isRead: true, readAt: new Date().toISOString(), zone } : p
          ),
        }));
      },

      setNoRecommend: (paperId) => {
        set((state) => ({
          savedPapers: state.savedPapers.map((p) =>
            p.id === paperId ? { ...p, noRecommend: true } : p
          ),
        }));
      },

      addNote: (paperId, note) => {
        set((state) => ({
          savedPapers: state.savedPapers.map((p) =>
            p.id === paperId
              ? {
                  ...p,
                  notes: [
                    ...p.notes,
                    {
                      ...note,
                      id: crypto.randomUUID(),
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : p
          ),
        }));
      },

      updateNote: (paperId, noteId, content) => {
        set((state) => ({
          savedPapers: state.savedPapers.map((p) =>
            p.id === paperId
              ? {
                  ...p,
                  notes: p.notes.map((n) =>
                    n.id === noteId ? { ...n, content } : n
                  ),
                }
              : p
          ),
        }));
      },

      deleteNote: (paperId, noteId) => {
        set((state) => ({
          savedPapers: state.savedPapers.map((p) =>
            p.id === paperId
              ? {
                  ...p,
                  notes: p.notes.filter((n) => n.id !== noteId),
                }
              : p
          ),
        }));
      },

      isInLibrary: (paperId) => {
        return get().savedPapers.some((p) => p.id === paperId);
      },

      isInZone: (paperId, zone) => {
        const paper = get().savedPapers.find((p) => p.id === paperId);
        return paper?.zone === zone;
      },

      getPaperById: (paperId) => {
        return get().savedPapers.find((p) => p.id === paperId);
      },

      getPapersByZone: (zone) => {
        return get().savedPapers.filter((p) => p.zone === zone);
      },

      isRead: (paperId) => {
        const paper = get().savedPapers.find((p) => p.id === paperId);
        return paper?.isRead || false;
      },

      isNoRecommend: (paperId) => {
        const paper = get().savedPapers.find((p) => p.id === paperId);
        return paper?.noRecommend || false;
      },
    }),
    {
      name: "paper-library",
    }
  )
);
