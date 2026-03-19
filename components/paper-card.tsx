"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { FileText, ExternalLink, BookOpen, Bookmark, BookmarkCheck, BookOpenCheck, Zap, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Paper } from "@/lib/actions";
import { formatDateShort, truncateText } from "@/lib/utils";
import { useLibraryStore, PaperZone } from "@/lib/library-store";

interface PaperCardProps {
  paper: Paper;
  index?: number;
}

// 翻译队列 - 限制并发请求数量
interface TranslationTask {
  title: string;
  paperId: string;
  resolve: (value: string | PromiseLike<string>) => void;
}

const translationQueue: TranslationTask[] = [];
let isProcessingQueue = false;

async function processTranslationQueue() {
  if (isProcessingQueue || translationQueue.length === 0) return;
  isProcessingQueue = true;

  while (translationQueue.length > 0) {
    const { title, paperId, resolve } = translationQueue.shift()!;
    const cacheKey = `title_trans_${paperId}`;

    // 检查缓存
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        resolve(cached);
        continue;
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperTitle: title,
          paperAbstract: "",
          isTranslationRequest: true
        })
      });

      const text = await response.text();
      const translated = text.trim() || title;

      // 缓存结果
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, translated);
      }

      resolve(translated);
    } catch {
      resolve(title);
    }

    // 请求间隔，避免同时发送太多
    await new Promise(r => setTimeout(r, 100));
  }

  isProcessingQueue = false;
}

function translateTitle(title: string, paperId: string): Promise<string> {
  return new Promise((resolve) => {
    const cacheKey = `title_trans_${paperId}`;

    // 检查缓存
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        resolve(cached);
        return;
      }
    }

    // 加入队列
    translationQueue.push({ title, paperId, resolve });
    processTranslationQueue();
  });
}

export function PaperCard({ paper, index = 0 }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const { addToLibrary, removeFromLibrary, isInLibrary } = useLibraryStore();

  useEffect(() => {
    setIsSaved(isInLibrary(paper.id));
  }, [paper.id, isInLibrary]);

  // 翻译标题 - 只在没有缓存时翻译
  useEffect(() => {
    const cachedKey = `title_trans_${paper.id}`;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cachedKey);
      if (cached) {
        setTranslatedTitle(cached);
        return;
      }
    }

    setTranslating(true);
    translateTitle(paper.title, paper.id).then(translated => {
      setTranslatedTitle(translated);
      setTranslating(false);
    }).catch(() => {
      setTranslating(false);
    });
  }, [paper.title, paper.id]);

  const handleSaveToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSaved) {
      removeFromLibrary(paper.id);
      setShowZoneSelector(false);
    } else {
      setShowZoneSelector(!showZoneSelector);
    }
  };

  const handleSaveToZone = (zone: PaperZone) => {
    addToLibrary({
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract || "",
      source: paper.source as "arxiv" | "openreview",
      sourceUrl: paper.sourceUrl || "",
      pdfUrl: paper.pdfUrl || "",
      tags: paper.tags,
      highlights: paper.highlights,
      publishedAt: paper.publishedAt ? paper.publishedAt.toString() : "",
    }, zone);
    setIsSaved(true);
    setShowZoneSelector(false);
  };

  // Extract venue from source URL (e.g., arxiv:2401.12345 -> arXiv:2401.12345)
  const getSourceDisplay = () => {
    if (paper.source === "arxiv" && paper.sourceUrl) {
      // Extract arxiv ID from URL
      const match = paper.sourceUrl.match(/(\d+\.\d+)/);
      const arxivId = match ? match[1] : null;
      return (
        <span className="text-xs font-mono text-orange-500">
          arXiv:{arxivId || ""}
        </span>
      );
    }
    return (
      <span className="text-xs font-mono text-green-500">OpenReview</span>
    );
  };

  const sourceLabel = getSourceDisplay();

  const authorDisplay = paper.authors.length > 3
    ? `${paper.authors.slice(0, 3).join(", ")} +${paper.authors.length - 3}`
    : paper.authors.join(", ");

  return (
    <Card
      className="flex flex-col h-full hover:border-primary/30 transition-colors"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {sourceLabel}
          </div>
          <div className="flex items-center gap-2">
            {paper.publishedAt && (
              <span className="text-xs text-muted-foreground">
                {formatDateShort(new Date(paper.publishedAt))}
              </span>
            )}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleSaveToggle}
                title={isSaved ? "Remove from library" : "Save to library"}
              >
                {isSaved ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
              {/* Zone Selector Dropdown */}
              {showZoneSelector && !isSaved && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-background border border-border rounded-md shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => handleSaveToZone("deep")}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <BookOpenCheck className="h-3.5 w-3.5 text-amber-500" />
                    精读区
                  </button>
                  <button
                    onClick={() => handleSaveToZone("quick")}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <Zap className="h-3.5 w-3.5 text-blue-500" />
                    速读区
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <Link href={`/paper/${paper.id}`} className="group">
          <h3 className="text-base font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2 mt-1">
            {paper.title}
          </h3>
          {translatedTitle && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-2">
              {translatedTitle}
            </p>
          )}
          {translating && (
            <p className="text-sm text-muted-foreground/60 mt-1 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              翻译中...
            </p>
          )}
        </Link>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
          {authorDisplay}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {paper.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="default" className="text-xs">
              {tag}
            </Badge>
          ))}
          {paper.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{paper.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-3 border-t border-border">
          <Button variant="secondary" size="sm" className="flex-1" asChild>
            <Link href={`/paper/${paper.id}`}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Details
            </Link>
          </Button>
          {paper.pdfUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
