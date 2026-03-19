"use client";

import { useEffect, useState } from "react";
import { Paper, getAllPapersList } from "@/lib/actions";
import { PaperContentTabs } from "@/components/paper-content-tabs";
import { ChatInterface } from "@/components/chat-interface";
import { RelatedPapers } from "@/components/related-papers";
import { useReadHistoryStore } from "@/lib/read-history";
import { useLibraryStore, PaperZone } from "@/lib/library-store";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Calendar, User, Tag, Bookmark, BookmarkCheck, BookOpenCheck, Zap, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils";
import { StarRating } from "@/components/star-rating";

interface PaperPageClientProps {
  paper: Paper;
}

export function PaperPageClient({ paper }: PaperPageClientProps) {
  const { markAsRead } = useReadHistoryStore();
  const { addToLibrary, removeFromLibrary, isInLibrary, getPaperById, setStars, markAsRead: markPaperAsRead, setNoRecommend } = useLibraryStore();
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [savedPaper, setSavedPaper] = useState<{ stars: number; isRead: boolean; zone: string } | null>(null);
  const [showReadDialog, setShowReadDialog] = useState(false);

  // Mark paper as read when viewed
  useEffect(() => {
    markAsRead(paper.id);
  }, [paper.id, markAsRead]);

  // Check if paper is in library
  useEffect(() => {
    setIsSaved(isInLibrary(paper.id));
    const paperData = getPaperById(paper.id);
    if (paperData) {
      setSavedPaper({
        stars: paperData.stars || 0,
        isRead: paperData.isRead || false,
        zone: paperData.zone || "deep"
      });
    }
  }, [paper.id, isInLibrary, getPaperById]);

  // Load all papers for related papers
  useEffect(() => {
    async function loadPapers() {
      const papers = await getAllPapersList();
      setAllPapers(papers);
    }
    loadPapers();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 h-8">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          <span className="text-xs">返回</span>
        </Button>
      </Link>

      {/* Desktop Layout - Full width PDF view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[5mm]">
        {/* Left Column - Metadata */}
        <div className="lg:col-span-3 order-2 lg:order-1 flex flex-col gap-[5mm]">
          <Card className="flex-1 sticky top-20 overflow-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">详细信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {/* Source */}
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  <span>来源</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {paper.source === "arxiv" ? "arXiv" : "OpenReview"}
                </Badge>
              </div>

              {/* Published Date */}
              {paper.publishedAt && (
                <div>
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>发布时间</span>
                  </div>
                  <p className="text-xs">
                    {formatDateShort(new Date(paper.publishedAt))}
                  </p>
                </div>
              )}

              {/* Authors */}
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span>作者</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {paper.authors.slice(0, 5).map((author, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {author.split(" ").pop()}
                    </Badge>
                  ))}
                  {paper.authors.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{paper.authors.length - 5}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  <span>标签</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {paper.tags.slice(0, 4).map((tag, index) => (
                    <Badge key={index} variant="default" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Links */}
              <div className="pt-3 border-t border-border space-y-2">
                {/* Save to Library Button */}
                <div className="relative">
                  <button
                    onClick={() => {
                      if (isSaved) {
                        removeFromLibrary(paper.id);
                        setIsSaved(false);
                      } else {
                        setShowZoneSelector(!showZoneSelector);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md transition-colors text-xs font-medium ${
                      isSaved
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="h-3.5 w-3.5" />
                        已收藏
                      </>
                    ) : (
                    <>
                      <Bookmark className="h-3.5 w-3.5" />
                      收藏
                    </>
                  )}
                </button>

                {/* Zone Selector Dropdown */}
                {showZoneSelector && !isSaved && (
                  <div className="absolute left-0 right-0 mt-1 z-10 bg-background border border-border rounded-md shadow-lg py-1">
                    <button
                      onClick={() => {
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
                        }, "deep");
                        setIsSaved(true);
                        setShowZoneSelector(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                    >
                      <BookOpenCheck className="h-3.5 w-3.5 text-amber-500" />
                      精读区
                    </button>
                    <button
                      onClick={() => {
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
                        }, "quick");
                        setIsSaved(true);
                        setShowZoneSelector(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                    >
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                      速读区
                    </button>
                  </div>
                )}
                </div>

                {/* Star Rating - Show when saved */}
                {isSaved && savedPaper && (
                  <div className="flex items-center justify-center gap-2 px-3 py-2 bg-accent rounded-md">
                    <span className="text-xs text-foreground font-medium">评分</span>
                    <StarRating
                      stars={savedPaper.stars}
                      onChange={(stars) => {
                        setStars(paper.id, stars);
                        setSavedPaper({ ...savedPaper, stars });
                      }}
                    />
                  </div>
                )}

                {/* 已读完 Button */}
                {isSaved && savedPaper && !savedPaper.isRead && (
                  <button
                    onClick={() => setShowReadDialog(true)}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-xs font-medium"
                  >
                    <Check className="h-3.5 w-3.5" />
                    已读完
                  </button>
                )}
                {isSaved && savedPaper?.isRead && (
                  <div className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium">
                    <Check className="h-3.5 w-3.5" />
                    已读完
                  </div>
                )}

                {paper.pdfUrl && (
                  <a
                    href={paper.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    PDF
                  </a>
                )}
                {paper.sourceUrl && (
                  <a
                    href={paper.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-xs font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    来源
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Related Papers */}
          <div className="mt-[5mm]">
            <RelatedPapers currentPaper={paper} allPapers={allPapers} />
          </div>
        </div>

        {/* Middle Column - Content with Tabs - Wider */}
        <div className="lg:col-span-6 order-1 lg:order-2 overflow-hidden">
          <PaperContentTabs paper={paper} />
        </div>

        {/* Right Column - Chat */}
        <div className="lg:col-span-3 order-3 lg:order-3 flex flex-col">
          <div className="flex-1 min-h-0">
            <ChatInterface paper={paper} />
          </div>
        </div>
      </div>

      {/* Read Dialog - Fixed overlay outside card */}
      {showReadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-background rounded-lg p-4 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">将论文移动到?</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  markPaperAsRead(paper.id, "read");
                  setShowReadDialog(false);
                  setSavedPaper({ ...savedPaper!, isRead: true, zone: "read" });
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent rounded-md text-left"
              >
                <Check className="h-4 w-4 text-green-500" />
                已读完文献库
              </button>
              <button
                onClick={() => {
                  markPaperAsRead(paper.id, "deep");
                  setShowReadDialog(false);
                  setSavedPaper({ ...savedPaper!, isRead: true, zone: "deep" });
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent rounded-md text-left"
              >
                <BookOpenCheck className="h-4 w-4 text-amber-500" />
                留在精读区
              </button>
              <button
                onClick={() => {
                  markPaperAsRead(paper.id, "quick");
                  setShowReadDialog(false);
                  setSavedPaper({ ...savedPaper!, isRead: true, zone: "quick" });
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent rounded-md text-left"
              >
                <Zap className="h-4 w-4 text-blue-500" />
                留在速读区
              </button>
              <button
                onClick={() => {
                  setNoRecommend(paper.id);
                  setShowReadDialog(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent rounded-md text-left text-red-500"
              >
                <span className="text-lg">×</span>
                不再推荐
              </button>
            </div>
            <button
              onClick={() => setShowReadDialog(false)}
              className="mt-3 w-full px-3 py-2 text-sm border rounded-md hover:bg-accent"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

