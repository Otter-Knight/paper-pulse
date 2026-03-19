/**
 * 用户反馈追踪与学习系统
 *
 * 功能：
 * 1. 追踪用户行为 (保存、阅读、跳过、评分)
 * 2. 维护用户兴趣画像
 * 3. 兴趣漂移检测
 * 4. 定期重校准
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PaperZone = 'deep' | 'quick' | 'read';

export interface SavedPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  source: 'arxiv' | 'openreview';
  sourceUrl: string;
  pdfUrl: string;
  tags: string[];
  highlights: string[];
  publishedAt: string;
  savedAt: string;
  zone: PaperZone;
  notes: PaperNote[];
  stars: number;
  isRead: boolean;
  readAt?: string;
  noRecommend: boolean;
  skipped: boolean; // 新增：跳过标记
}

export interface PaperNote {
  id: string;
  content: string;
  position: 'beginning' | 'end' | 'side';
  color: string;
  createdAt: string;
}

// 兴趣画像
export interface InterestProfile {
  // 标签权重 (标签 -> 权重)
  tagWeights: Record<string, number>;
  // 作者权重
  authorWeights: Record<string, number>;
  // 累计交互次数
  totalInteractions: number;
  // 上次更新时间
  lastUpdated: string;
  // 短期兴趣标签 (最近7天)
  recentTags: string[];
  // 长期兴趣标签 (历史累积)
  longTermTags: string[];
}

// 行为统计
export interface BehaviorStats {
  totalViewed: number;
  totalSaved: number;
  totalRead: number;
  totalStarred: number;
  totalSkipped: number;
  avgSessionLength: number;
  lastActiveDate: string;
}

interface FeedbackStore {
  // 用户画像
  interestProfile: InterestProfile;
  behaviorStats: BehaviorStats;

  // 行为追踪方法
  trackSave: (paper: SavedPaper) => void;
  trackRead: (paperId: string) => void;
  trackUnread: (paperId: string) => void;
  trackStar: (paperId: string, stars: number) => void;
  trackSkip: (paperId: string) => void;
  trackNoRecommend: (paperId: string) => void;
  trackView: (paperId: string) => void;

  // 画像更新方法
  updateProfile: () => void;
  recalibrateProfile: () => void;
  detectInterestDrift: () => boolean;

  // 辅助方法
  getTagWeights: () => Record<string, number>;
  getTopTags: (limit?: number) => string[];
  getRecentInterest: () => string[];
}

const DEFAULT_INTEREST_PROFILE: InterestProfile = {
  tagWeights: {},
  authorWeights: {},
  totalInteractions: 0,
  lastUpdated: new Date().toISOString(),
  recentTags: [],
  longTermTags: [],
};

const DEFAULT_BEHAVIOR_STATS: BehaviorStats = {
  totalViewed: 0,
  totalSaved: 0,
  totalRead: 0,
  totalStarred: 0,
  totalSkipped: 0,
  avgSessionLength: 0,
  lastActiveDate: new Date().toISOString(),
};

// EMA系数
const EMA_ALPHA = 0.3;
const RECENT_TAG_DAYS = 7;

export const useFeedbackStore = create<FeedbackStore>()(
  persist(
    (set, get) => ({
      interestProfile: DEFAULT_INTEREST_PROFILE,
      behaviorStats: DEFAULT_BEHAVIOR_STATS,

      // 追踪保存行为
      trackSave: (paper) => {
        const { interestProfile, behaviorStats } = get();

        // 更新标签权重 (指数移动平均)
        const newTagWeights = { ...interestProfile.tagWeights };
        paper.tags.forEach(tag => {
          const lowerTag = tag.toLowerCase();
          const currentWeight = newTagWeights[lowerTag] || 0;
          newTagWeights[lowerTag] = currentWeight * (1 - EMA_ALPHA) + EMA_ALPHA;
        });

        // 更新作者权重
        const newAuthorWeights = { ...interestProfile.authorWeights };
        paper.authors.forEach(author => {
          const lowerAuthor = author.toLowerCase();
          const currentWeight = newAuthorWeights[lowerAuthor] || 0;
          newAuthorWeights[lowerAuthor] = currentWeight * (1 - EMA_ALPHA) + EMA_ALPHA;
        });

        // 更新最近标签
        const recentTags = [...new Set([...interestProfile.recentTags, ...paper.tags])]
          .slice(-50);

        set({
          interestProfile: {
            ...interestProfile,
            tagWeights: newTagWeights,
            authorWeights: newAuthorWeights,
            totalInteractions: interestProfile.totalInteractions + 1,
            lastUpdated: new Date().toISOString(),
            recentTags,
          },
          behaviorStats: {
            ...behaviorStats,
            totalSaved: behaviorStats.totalSaved + 1,
            lastActiveDate: new Date().toISOString(),
          },
        });

        // 检查是否需要兴趣漂移检测
        get().detectInterestDrift();
      },

      // 追踪阅读行为
      trackRead: (paperId) => {
        const { behaviorStats } = get();
        set({
          behaviorStats: {
            ...behaviorStats,
            totalRead: behaviorStats.totalRead + 1,
            lastActiveDate: new Date().toISOString(),
          },
        });
      },

      // 追踪取消阅读
      trackUnread: (paperId) => {
        const { interestProfile } = get();
        // 减少相关标签权重
        const newTagWeights = { ...interestProfile.tagWeights };
        Object.keys(newTagWeights).forEach(tag => {
          newTagWeights[tag] *= 0.95; // 轻微衰减
        });

        set({
          interestProfile: {
            ...interestProfile,
            tagWeights: newTagWeights,
          },
        });
      },

      // 追踪评分行为 (高评分增强权重，低评分减弱)
      trackStar: (paperId, stars) => {
        const { interestProfile, behaviorStats } = get();
        // 评分 >= 4 增强兴趣，<= 2 减弱兴趣
        const multiplier = stars >= 4 ? 1.2 : stars <= 2 ? 0.8 : 1;

        set({
          interestProfile: {
            ...interestProfile,
            totalInteractions: interestProfile.totalInteractions + 1,
            lastUpdated: new Date().toISOString(),
          },
          behaviorStats: {
            ...behaviorStats,
            totalStarred: behaviorStats.totalStarred + 1,
            lastActiveDate: new Date().toISOString(),
          },
        });
      },

      // 追踪跳过行为
      trackSkip: (paperId) => {
        const { behaviorStats } = get();
        set({
          behaviorStats: {
            ...behaviorStats,
            totalSkipped: behaviorStats.totalSkipped + 1,
            lastActiveDate: new Date().toISOString(),
          },
        });
      },

      // 追踪不感兴趣
      trackNoRecommend: (paperId) => {
        const { interestProfile } = get();
        // 减少权重但不删除
        const newTagWeights = { ...interestProfile.tagWeights };
        Object.keys(newTagWeights).forEach(tag => {
          newTagWeights[tag] *= 0.7;
        });

        set({
          interestProfile: {
            ...interestProfile,
            tagWeights: newTagWeights,
          },
        });
      },

      // 追踪浏览
      trackView: (paperId) => {
        const { behaviorStats } = get();
        set({
          behaviorStats: {
            ...behaviorStats,
            totalViewed: behaviorStats.totalViewed + 1,
            lastActiveDate: new Date().toISOString(),
          },
        });
      },

      // 手动更新画像 (在保存偏好后调用)
      updateProfile: () => {
        const { interestProfile } = get();

        // 将部分近期标签转为长期标签
        const recentToLongTerm = interestProfile.recentTags.slice(0, 10);
        const longTermTags = [...new Set([...interestProfile.longTermTags, ...recentToLongTerm])];

        set({
          interestProfile: {
            ...interestProfile,
            longTermTags,
            lastUpdated: new Date().toISOString(),
          },
        });
      },

      // 定期重校准画像
      recalibrateProfile: () => {
        const { interestProfile } = get();

        // 归一化权重
        const weights = Object.values(interestProfile.tagWeights);
        const maxWeight = Math.max(...weights, 0.01);
        const normalizedWeights: Record<string, number> = {};

        Object.entries(interestProfile.tagWeights).forEach(([tag, weight]) => {
          normalizedWeights[tag] = weight / maxWeight;
        });

        // 清理低权重标签
        Object.entries(normalizedWeights).forEach(([tag, weight]) => {
          if (weight < 0.01) {
            delete normalizedWeights[tag];
          }
        });

        set({
          interestProfile: {
            ...interestProfile,
            tagWeights: normalizedWeights,
            lastUpdated: new Date().toISOString(),
          },
        });
      },

      // 兴趣漂移检测
      detectInterestDrift: () => {
        const { interestProfile } = get();

        if (interestProfile.recentTags.length < 5) {
          return false;
        }

        // 检查最近兴趣与长期兴趣的重叠度
        const recentSet = new Set(interestProfile.recentTags.map(t => t.toLowerCase()));
        const longTermSet = new Set(interestProfile.longTermTags.map(t => t.toLowerCase()));

        let overlap = 0;
        recentSet.forEach(tag => {
          if (longTermSet.has(tag)) overlap++;
        });

        const overlapRatio = overlap / recentSet.size;

        // 如果重叠度低于阈值，认为发生兴趣漂移
        if (overlapRatio < 0.3) {
          console.log('[Interest Drift Detected]', {
            recent: interestProfile.recentTags,
            longTerm: interestProfile.longTermTags,
            overlapRatio,
          });
          return true;
        }

        return false;
      },

      // 获取标签权重
      getTagWeights: () => {
        return get().interestProfile.tagWeights;
      },

      // 获取热门标签
      getTopTags: (limit = 10) => {
        const { interestProfile } = get();
        return Object.entries(interestProfile.tagWeights)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([tag]) => tag);
      },

      // 获取近期兴趣
      getRecentInterest: () => {
        return get().interestProfile.recentTags;
      },
    }),
    {
      name: 'paper-pulse-feedback',
    }
  )
);