import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PaperZone = "deep" | "quick"; // 精读区 | 速读区

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
  addToLibrary: (paper: Omit<SavedPaper, "savedAt" | "notes" | "zone">, zone?: PaperZone) => void;
  removeFromLibrary: (paperId: string) => void;
  moveToZone: (paperId: string, zone: PaperZone) => void;
  addNote: (paperId: string, note: Omit<PaperNote, "id" | "createdAt">) => void;
  updateNote: (paperId: string, noteId: string, content: string) => void;
  deleteNote: (paperId: string, noteId: string) => void;
  isInLibrary: (paperId: string) => boolean;
  isInZone: (paperId: string, zone: PaperZone) => boolean;
  getPaperById: (paperId: string) => SavedPaper | undefined;
  getPapersByZone: (zone: PaperZone) => SavedPaper[];
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
    }),
    {
      name: "paper-library",
    }
  )
);
