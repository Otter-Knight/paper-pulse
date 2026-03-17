"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { FileText, ExternalLink, BookOpen, Bookmark, BookmarkCheck, BookOpenCheck, Zap } from "lucide-react";
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

export function PaperCard({ paper, index = 0 }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showZoneSelector, setShowZoneSelector] = useState(false);

  const { addToLibrary, removeFromLibrary, isInLibrary, isInZone } = useLibraryStore();

  useEffect(() => {
    setIsSaved(isInLibrary(paper.id));
  }, [paper.id, isInLibrary]);

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
        </Link>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
          {authorDisplay}
        </p>

        <p className={`text-sm text-secondary-foreground leading-relaxed flex-1 ${expanded ? '' : 'line-clamp-3'}`}>
          {paper.abstract ? (
            expanded ? paper.abstract : truncateText(paper.abstract, 150)
          ) : (
            <span className="italic text-muted-foreground text-xs">No abstract available</span>
          )}
        </p>

        {paper.abstract && paper.abstract.length > 150 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 px-2 text-xs self-start"
            onClick={() => setExpanded(!expanded)}
          >
            <BookOpen className="h-3 w-3 mr-1" />
            {expanded ? "Show less" : "Read more"}
          </Button>
        )}

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
