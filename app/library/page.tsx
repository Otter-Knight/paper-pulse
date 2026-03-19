"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLibraryStore, SavedPaper, PaperZone } from "@/lib/library-store";
import { FileText, Trash2, ExternalLink, Calendar, StickyNote, BookOpenCheck, Zap, ArrowRight, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type SortOption = "time" | "stars";

export default function LibraryPage() {
  const { savedPapers, removeFromLibrary, moveToZone } = useLibraryStore();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<PaperZone | "all">("deep");
  const [sortOption, setSortOption] = useState<SortOption>("time");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sort papers
  const sortedPapers = [...savedPapers].sort((a, b) => {
    if (sortOption === "stars") {
      return (b.stars || 0) - (a.stars || 0);
    }
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });

  // Filter by zone
  const deepPapers = sortedPapers.filter((p) => p.zone === "deep");
  const quickPapers = sortedPapers.filter((p) => p.zone === "quick");
  const readPapers = sortedPapers.filter((p) => p.zone === "read");

  const displayedPapers = activeTab === "all"
    ? sortedPapers
    : activeTab === "deep"
      ? deepPapers
      : activeTab === "quick"
        ? quickPapers
        : readPapers;

  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">我的文库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            共收藏 {savedPapers.length} 篇论文
          </p>
        </div>
      </div>

      {/* Zone Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("deep")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors ${
            activeTab === "deep"
              ? "bg-amber-500/10 text-amber-600 border-b-2 border-amber-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpenCheck className="h-4 w-4" />
          精读区
          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
            {deepPapers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("quick")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors ${
            activeTab === "quick"
              ? "bg-blue-500/10 text-blue-600 border-b-2 border-blue-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="h-4 w-4" />
          速读区
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
            {quickPapers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("read")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors ${
            activeTab === "read"
              ? "bg-green-500/10 text-green-600 border-b-2 border-green-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Check className="h-4 w-4" />
          已读完
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
            {readPapers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors ${
            activeTab === "all"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          全部
          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
            {savedPapers.length}
          </span>
        </button>

        {/* Sort Options */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">排序:</span>
          <button
            onClick={() => setSortOption("time")}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              sortOption === "time" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            收藏顺序
          </button>
          <button
            onClick={() => setSortOption("stars")}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
              sortOption === "stars" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            <Star className="h-3 w-3" />
            星星数
          </button>
        </div>
      </div>

      {displayedPapers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {activeTab === "deep" ? "精读区暂无论文" : activeTab === "quick" ? "速读区暂无论文" : activeTab === "read" ? "已读完区暂无论文" : "还没有收藏任何论文"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {activeTab === "all" ? "从每日论文流中收藏论文来构建你的文库" : "点击收藏按钮并选择区域来添加论文"}
          </p>
          <Button asChild>
            <Link href="/">浏览论文</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedPapers.map((paper) => (
            <div
              key={paper.id}
              className="p-4 border border-border rounded-lg hover:border-primary/20 transition-colors bg-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Zone Badge */}
                    <span className={`badge text-xs font-medium px-2 py-0.5 rounded-full ${
                      paper.zone === "deep"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {paper.zone === "deep" ? "精读" : "速读"}
                    </span>
                    <span className={`badge text-xs font-mono ${
                      paper.source === "arxiv"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {paper.source === "arxiv" ? "arXiv" : "OpenReview"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(paper.savedAt).toLocaleDateString()}
                    </span>
                    {paper.notes.length > 0 && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <StickyNote className="w-3 h-3" />
                        {paper.notes.length} 条笔记
                      </span>
                    )}
                  </div>

                  <Link href={`/paper/${paper.id}`}>
                    <h3 className="font-semibold hover:text-primary transition-colors line-clamp-1">
                      {paper.title}
                    </h3>
                    {/* Stars display */}
                    {(paper.stars || 0) > 0 && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= (paper.stars || 0)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-transparent text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </Link>

                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {paper.authors.join(", ")}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {paper.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="badge text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Move to other zone button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveToZone(paper.id, paper.zone === "deep" ? "quick" : "deep")}
                    title={paper.zone === "deep" ? "移至速读区" : "移至精读区"}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {paper.zone === "deep" ? (
                      <Zap className="w-4 h-4" />
                    ) : (
                      <BookOpenCheck className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/paper/${paper.id}`}>
                      <FileText className="w-4 h-4 mr-1" />
                      查看
                    </Link>
                  </Button>
                  {paper.pdfUrl && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromLibrary(paper.id)}
                    title="从文库移除"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
