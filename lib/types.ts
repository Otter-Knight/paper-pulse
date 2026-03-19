/**
 * 推荐系统类型定义
 */

export interface Paper {
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

export interface UserPreferences {
  keywords: string[];
  authors: string[];
  categories: string[];
  timeRange: string;
  sources: string[];
  venues: string[];
}

export interface PaperFeedback {
  paperId: string;
  savedAt: string;
  readAt?: string;
  stars?: number;
  tags: string[];
}

export interface UserFeedback {
  savedPapers: Map<string, PaperFeedback>;
  readPapers: Set<string>;
  starredPapers: Map<string, number>;
  noRecommendPapers: Set<string>;
  skippedPapers: Set<string>;
}

export interface ScoredPaper {
  paper: Paper;
  score: number;
  contentScore: number;
  preferenceScore: number;
  freshnessScore: number;
  diversityScore: number;
}

export interface ScoreDetail {
  paperId: string;
  totalScore: number;
  contentScore: number;
  preferenceScore: number;
  freshnessScore: number;
}

export interface RecommendationResult {
  papers: Paper[];
  scores: ScoreDetail[];
  totalAvailable: number;
  metadata: {
    generatedAt: string;
    algorithm: string;
    config: Record<string, any>;
  };
}

export interface EvaluationMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  diversity: number;
  novelty: number;
  coverage: number;
}

export interface UserInterestProfile {
  tagWeights: Record<string, number>;
  authorWeights: Record<string, number>;
  lastUpdated: string;
  totalInteractions: number;
}