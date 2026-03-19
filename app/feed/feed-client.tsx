"use client";

import { useState, useEffect, useMemo } from "react";
import { Settings } from "lucide-react";
import { PaperCard } from "@/components/paper-card";
import { Button } from "@/components/ui/button";
import { InterestsModal } from "@/components/interests-modal";
import { useLibraryStore } from "@/lib/library-store";
import {
  generateRecommendations,
  coldStartRecommendations,
  RECOMMENDATION_CONFIG,
} from "@/lib/recommendation-engine";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  source: string;
  sourceUrl: string | null;
  pdfUrl: string | null;
  tags: string[];
  highlights: string[];
  publishedAt: Date | null;
  createdAt: Date;
}

const defaultPreferences = {
  keywords: [] as string[],
  authors: [] as string[],
  categories: [] as string[],
  timeRange: "all",
  sources: ["all"] as string[],
  venues: [] as string[],
};

function filterPapers(
  papers: Paper[],
  keywords: string[],
  authors: string[],
  categories: string[],
  timeRange: string,
  sources: string[],
  venues: string[] = []
): Paper[] {
  const now = new Date();

  return papers.filter((paper) => {
    // Source filter
    if (sources.length > 0 && !sources.includes("all") && !sources.includes(paper.source)) {
      return false;
    }

    // Time filter
    if (timeRange !== "all" && paper.publishedAt) {
      const publishedDate = new Date(paper.publishedAt);
      const monthsMap: Record<string, number> = {
        all: 0,
        "3months": 3,
        "6months": 6,
        "1year": 12,
      };
      const months = monthsMap[timeRange] || 0;
      const cutoffDate = new Date(now);
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      if (publishedDate < cutoffDate) {
        return false;
      }
    }

    // Keyword filter - 搜索标题、摘要和标签
    if (keywords.length > 0) {
      const searchText = `${paper.title} ${paper.abstract || ""} ${paper.tags.join(" ")}`.toLowerCase();
      const hasKeyword = keywords.some((kw) => {
        const kwLower = kw.toLowerCase();
        // 匹配关键词的任何部分
        return searchText.includes(kwLower) ||
               kwLower.split(/[\s\-_]/).some(part => part.length > 2 && searchText.includes(part));
      });
      if (!hasKeyword) return false;
    }

    // Author filter
    if (authors.length > 0) {
      const hasAuthor = authors.some((author) =>
        paper.authors.some((a) => a.toLowerCase().includes(author.toLowerCase()))
      );
      if (!hasAuthor) return false;
    }

    // Category/tag filter
    if (categories.length > 0) {
      const hasCategory = categories.some((cat) =>
        paper.tags.some((tag) => tag.toLowerCase().includes(cat.toLowerCase()))
      );
      if (!hasCategory) return false;
    }

    // Venue filter - 暂时禁用，因为论文数据中没有独立的venue字段
    // TODO: 未来可以从标签中提取或添加专门的venue字段
    if (venues.length > 0) {
      // 暂时不做过滤，或者可以从标签中匹配
      const hasVenue = venues.some((venue) =>
        paper.tags.some((tag) => tag.toLowerCase().includes(venue.toLowerCase()))
      );
      if (!hasVenue) return false;
    }

    return true;
  });
}

export default function FeedClient({ initialPapers }: { initialPapers: Paper[] }) {
  const [allPapers] = useState<Paper[]>(initialPapers);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [excludeRead, setExcludeRead] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const { isRead, isNoRecommend } = useLibraryStore();

  // Load saved preferences and listen for changes
  useEffect(() => {
    const loadPreferences = () => {
      const saved = localStorage.getItem("paperPulse_preferences");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPreferences({ ...defaultPreferences, ...parsed });
        } catch {
          // use default
        }
      }
    };

    // Load on mount
    loadPreferences();
    setPrefsLoaded(true);

    // Listen for storage changes from other tabs/components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "paperPulse_preferences") {
        loadPreferences();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 每天首次访问时自动爬取论文
  useEffect(() => {
    if (!prefsLoaded) return;

    const lastFetch = localStorage.getItem("paperPulse_lastFetch");
    const now = new Date();
    const today = now.toDateString();

    // 检查是否今天已经爬取过
    if (lastFetch) {
      const lastFetchDate = new Date(lastFetch).toDateString();
      if (lastFetchDate === today) {
        console.log("Already fetched papers today");
        return;
      }
    }

    // 有偏好设置时才爬取
    const hasPrefs = preferences.keywords.length > 0 ||
      preferences.categories.length > 0 ||
      preferences.authors.length > 0;

    if (hasPrefs && initialPapers.length > 0) {
      console.log("Triggering daily paper fetch...");
      setIsLoading(true);
      setFetchStatus("正在根据您的兴趣爬取论文...");
      fetch("/api/cron/fetch-by-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: preferences.keywords,
          authors: preferences.authors,
          categories: preferences.categories,
          timeRange: preferences.timeRange,
          minPapers: 300,
        }),
      }).then(res => res.json()).then(result => {
        console.log("Daily fetch result:", result);
        localStorage.setItem("paperPulse_lastFetch", now.toISOString());
        setFetchStatus(result.papersProcessed > 0
          ? `已获取 ${result.papersProcessed} 篇新论文！`
          : "今日已最新，无需更新");
        setIsLoading(false);
        if (result.papersProcessed > 0) {
          setTimeout(() => window.location.reload(), 1500);
        }
      }).catch(err => {
        console.error("Daily fetch failed:", err);
        setIsLoading(false);
        setFetchStatus("获取论文失败，请稍后重试");
      });
    }
  }, [prefsLoaded, preferences, initialPapers.length]);

  // 智能推荐算法
  const filteredPapers = useMemo(() => {
    // 等待偏好加载完成后再筛选
    if (!prefsLoaded) {
      return allPapers;
    }

    // 如果没有任何筛选条件，使用冷启动推荐
    const hasFilters = preferences.keywords.length > 0 ||
      preferences.categories.length > 0 ||
      preferences.authors.length > 0 ||
      preferences.venues.length > 0 ||
      preferences.timeRange !== "all" ||
      (preferences.sources.length > 0 && !preferences.sources.includes("all"));

    if (!hasFilters) {
      // 冷启动：返回最新论文
      return coldStartRecommendations(allPapers, [], 50);
    }

    // 构建反馈数据
    const feedback = {
      savedPapers: new Map(),
      readPapers: new Set<string>(),
      starredPapers: new Map<string, number>(),
      noRecommendPapers: new Set<string>(),
      skippedPapers: new Set<string>(),
    };

    // 从本地存储获取用户历史行为
    try {
      const library = localStorage.getItem('paper-library');
      if (library) {
        const parsed = JSON.parse(library);
        parsed.savedPapers?.forEach((p: any) => {
          feedback.savedPapers.set(p.id, {
            paperId: p.id,
            savedAt: p.savedAt,
            readAt: p.readAt,
            stars: p.stars,
            tags: p.tags || [],
          });
          if (p.isRead) feedback.readPapers.add(p.id);
          if (p.stars > 0) feedback.starredPapers.set(p.id, p.stars);
          if (p.noRecommend) feedback.noRecommendPapers.add(p.id);
        });
      }
    } catch (e) {
      console.error('Error loading feedback:', e);
    }

    // 使用智能推荐算法
    const result = generateRecommendations(
      allPapers,
      preferences,
      feedback,
      {
        maxResults: 50,
        excludeRead,
        timeRange: preferences.timeRange,
        enableDiversity: true,
        enableExploration: RECOMMENDATION_CONFIG.EXPLORATION_RATE > 0,
      }
    );

    // 如果推荐结果为空，回退到基础过滤
    if (result.papers.length === 0) {
      const filtered = filterPapers(
        allPapers,
        preferences.keywords,
        preferences.authors,
        preferences.categories,
        preferences.timeRange,
        preferences.sources,
        preferences.venues
      );

      // 排除已读论文
      return filtered.filter((paper) => {
        const read = isRead(paper.id);
        const noRecommend = isNoRecommend(paper.id);
        return excludeRead ? (!read && !noRecommend) : true;
      });
    }

    return result.papers;
  }, [allPapers, preferences, excludeRead, isRead, isNoRecommend, prefsLoaded]);

  const handleSavePreferences = async (newPrefs: typeof preferences) => {
    console.log("Saving preferences:", newPrefs);
    setPreferences(newPrefs);
    localStorage.setItem("paperPulse_preferences", JSON.stringify(newPrefs));

    // 检查是否是新的偏好设置
    const prevPrefs = localStorage.getItem("paperPulse_preferences");
    const isNewPrefs = !prevPrefs || JSON.stringify(newPrefs) !== prevPrefs;

    // 触发爬取论文（根据新偏好）
    if (isNewPrefs && (newPrefs.keywords.length > 0 || newPrefs.categories.length > 0 || newPrefs.authors.length > 0)) {
      try {
        console.log("Triggering paper fetch with new preferences...");
        const response = await fetch("/api/cron/fetch-by-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords: newPrefs.keywords,
            authors: newPrefs.authors,
            categories: newPrefs.categories,
            timeRange: newPrefs.timeRange,
            minPapers: 300,
          }),
        });
        const result = await response.json();
        console.log("Paper fetch result:", result);
      } catch (error) {
        console.error("Failed to fetch papers:", error);
      }
    }

    // 延迟刷新确保 localStorage 保存完成
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">个性化推荐</h1>
          <p className="text-sm text-muted-foreground mt-1">
            根据您的兴趣推荐的论文 ({filteredPapers.length} 篇)
          </p>
        </div>

        {/* Exclude Read Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={excludeRead}
            onChange={(e) => setExcludeRead(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">排除已读论文</span>
        </label>
      </div>

      {/* 爬取状态提示 */}
      {fetchStatus && (
        <div className="mb-4 p-3 bg-primary/10 rounded-lg text-sm text-primary">
          {fetchStatus}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Settings className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">没有找到符合条件的论文</h3>
          <p className="text-muted-foreground mb-4">试试调整你的兴趣偏好或筛选条件</p>
          <Button onClick={() => setModalOpen(true)}>
            设置兴趣偏好
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPapers.map((paper, index) => (
            <PaperCard key={paper.id} paper={paper} index={index} />
          ))}
        </div>
      )}

      <InterestsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSavePreferences}
      />

      {/* 浮动设置按钮 */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
        title="设置兴趣偏好"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}