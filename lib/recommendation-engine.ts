/**
 * 智能论文推荐引擎
 *
 * 优化特性：
 * 1. 多维度相似度计算 (内容 + 偏好 + 时效性)
 * 2. 反馈学习机制 (指数移动平均 + Bandit算法)
 * 3. 多样性控制 (MMR算法)
 * 4. 冷启动解决方案
 * 5. 性能优化 (缓存 + 预计算)
 */

// ==================== 类型定义 ====================

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
    config: Record<string, unknown>;
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

// ==================== 配置参数 ====================
export const RECOMMENDATION_CONFIG = {
  CONTENT_WEIGHT: 0.5,
  PREFERENCE_WEIGHT: 0.3,
  FRESHNESS_WEIGHT: 0.2,
  DIVERSITY_RATIO: 0.3,
  MAX_SIMILAR_TAGS: 2,
  EMA_ALPHA: 0.3,
  EXPLORATION_RATE: 0.1,
  CACHE_TTL: 1000 * 60 * 30,
  BATCH_SIZE: 50,
  COLD_START_KEYWORDS: ['机器学习', '深度学习', 'Transformer', '计算机视觉'],
  MIN_PAPERS_FOR_COLLAB: 10,
};

// ==================== 1. 内容相似度计算 ====================

export function calculateContentSimilarity(
  paper1: Paper,
  paper2: Paper
): number {
  let score = 0;

  const tags1 = new Set(paper1.tags.map(t => t.toLowerCase()));
  const tags2 = new Set(paper2.tags.map(t => t.toLowerCase()));
  const intersection = new Set([...tags1].filter(x => tags2.has(x)));
  const union = new Set([...tags1, ...tags2]);
  const jaccard = intersection.size / union.size;
  score += jaccard * 0.4;

  const title1Words = new Set(paper1.title.toLowerCase().split(/\s+/));
  const title2Words = new Set(paper2.title.toLowerCase().split(/\s+/));
  const titleIntersection = new Set([...title1Words].filter(x => title2Words.has(x)));
  const titleUnion = new Set([...title1Words, ...title2Words]);
  const titleJaccard = titleIntersection.size / titleUnion.size;
  score += titleJaccard * 0.3;

  const authors1 = new Set(paper1.authors.map(a => a.toLowerCase()));
  const authors2 = new Set(paper2.authors.map(a => a.toLowerCase()));
  const authorIntersection = new Set([...authors1].filter(x => authors2.has(x)));
  const authorJaccard = authorIntersection.size / Math.max(authors1.size, authors2.size, 1);
  score += authorJaccard * 0.2;

  if (paper1.abstract && paper2.abstract) {
    const abstractWords1 = extractKeywords(paper1.abstract);
    const abstractWords2 = extractKeywords(paper2.abstract);
    const absIntersection = new Set([...abstractWords1].filter(x => abstractWords2.has(x)));
    const absUnion = new Set([...abstractWords1, ...abstractWords2]);
    const absJaccard = absIntersection.size / absUnion.size;
    score += absJaccard * 0.1;
  }

  return Math.min(score, 1);
}

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'i', 'we', 'you', 'he', 'she', 'it', 'they', 'them', 'their', 'our', 'your', 'my', '提出', '提出一种', '本文', '方法', '基于', '使用', '通过', '实现', '进行']);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return new Set(words.slice(0, 50));
}

// ==================== 2. 偏好匹配分数 ====================

export function calculatePreferenceScore(
  paper: Paper,
  preferences: UserPreferences,
  feedback?: UserFeedback
): number {
  let score = 0;
  let weights = 0;

  if (preferences.keywords.length > 0) {
    const paperText = `${paper.title} ${paper.abstract || ''} ${paper.tags.join(' ')}`.toLowerCase();
    let keywordMatches = 0;
    for (const kw of preferences.keywords) {
      if (paperText.includes(kw.toLowerCase())) {
        keywordMatches++;
      }
    }
    score += (keywordMatches / preferences.keywords.length) * 0.35;
    weights += 0.35;
  }

  if (preferences.authors.length > 0) {
    let authorMatches = 0;
    for (const author of preferences.authors) {
      if (paper.authors.some(a => a.toLowerCase().includes(author.toLowerCase()))) {
        authorMatches++;
      }
    }
    score += (authorMatches / preferences.authors.length) * 0.2;
    weights += 0.2;
  }

  if (preferences.categories.length > 0) {
    const paperTagsLower = paper.tags.map(t => t.toLowerCase());
    let categoryMatches = 0;
    for (const cat of preferences.categories) {
      if (paperTagsLower.some(t => t.includes(cat.toLowerCase()))) {
        categoryMatches++;
      }
    }
    score += (categoryMatches / preferences.categories.length) * 0.25;
    weights += 0.25;
  }

  if (feedback) {
    const feedbackScore = getFeedbackEnhancement(paper, feedback);
    score += feedbackScore * 0.2;
    weights += 0.2;
  }

  return weights > 0 ? score / (weights / (score > 0 ? 1 : 1)) : 0;
}

function getFeedbackEnhancement(paper: Paper, feedback: UserFeedback): number {
  let boost = 0;
  const paperTags = new Set(paper.tags.map(t => t.toLowerCase()));
  const likedTags = new Map<string, number>();

  feedback.savedPapers.forEach((fb) => {
    fb.tags.forEach(tag => {
      const count = likedTags.get(tag.toLowerCase()) || 0;
      likedTags.set(tag.toLowerCase(), count + 1);
    });
  });

  paperTags.forEach(tag => {
    if (likedTags.has(tag)) {
      boost += Math.min(likedTags.get(tag)! / 5, 0.5);
    }
  });

  return Math.min(boost, 1);
}

// ==================== 3. 时效性分数 ====================

export function calculateFreshnessScore(paper: Paper, timeRange: string = 'all'): number {
  if (!paper.publishedAt) return 0.5;

  const now = new Date();
  const published = new Date(paper.publishedAt);
  const daysDiff = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);

  const halfLifeDays = 90;
  const score = Math.pow(0.5, daysDiff / halfLifeDays);

  const rangeMap: Record<string, number> = {
    '3months': 90,
    '6months': 180,
    '1year': 365,
    'all': Infinity,
  };

  const maxDays = rangeMap[timeRange] || Infinity;
  if (daysDiff > maxDays) return 0;

  return Math.min(score, 1);
}

// ==================== 4. 多样性控制 (MMR算法) ====================

export function applyDiversityMMR(
  scoredPapers: ScoredPaper[],
  maxResults: number = 20,
  diversityRatio: number = RECOMMENDATION_CONFIG.DIVERSITY_RATIO
): ScoredPaper[] {
  if (scoredPapers.length <= maxResults) return scoredPapers;

  const selected: ScoredPaper[] = [];
  const remaining = [...scoredPapers];

  remaining.sort((a, b) => b.score - a.score);
  selected.push(remaining.shift()!);

  while (selected.length < maxResults && remaining.length > 0) {
    let bestIdx = -1;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const paper = remaining[i];
      let maxSimilarity = 0;

      for (const selectedPaper of selected) {
        const similarity = calculateContentSimilarity(paper.paper, selectedPaper.paper);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      const mmr = (1 - diversityRatio) * paper.score + diversityRatio * (1 - maxSimilarity);

      if (mmr > bestMMR) {
        bestMMR = mmr;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      selected.push(remaining.splice(bestIdx, 1)[0]);
    }
  }

  return selected;
}

// ==================== 5. 反馈学习机制 ====================

export function updateInterestProfile(
  existingProfile: Map<string, number>,
  newTags: string[],
  decayFactor: number = RECOMMENDATION_CONFIG.EMA_ALPHA
): Map<string, number> {
  const profile = new Map(existingProfile);

  profile.forEach((value, key) => {
    profile.set(key, value * (1 - decayFactor));
  });

  newTags.forEach(tag => {
    const currentWeight = profile.get(tag) || 0;
    profile.set(tag, currentWeight + decayFactor);
  });

  profile.forEach((value, key) => {
    if (value < 0.01) {
      profile.delete(key);
    }
  });

  return profile;
}

export function epsilonGreedyChoice(
  papers: ScoredPaper[],
  explorationRate: number = RECOMMENDATION_CONFIG.EXPLORATION_RATE
): ScoredPaper[] {
  const sorted = [...papers].sort((a, b) => b.score - a.score);
  const exploreCount = Math.ceil(papers.length * explorationRate);
  const explorePapers = papers
    .sort(() => Math.random() - 0.5)
    .slice(0, exploreCount);

  const selectedIds = new Set(sorted.slice(0, papers.length - exploreCount).map(p => p.paper.id));
  const newExplorations = explorePapers.filter(p => !selectedIds.has(p.paper.id));

  return [
    ...sorted.slice(0, papers.length - exploreCount),
    ...newExplorations
  ];
}

export function detectInterestDrift(
  recentTags: string[],
  historicalProfile: Map<string, number>,
  threshold: number = 0.3
): boolean {
  if (historicalProfile.size === 0) return false;

  let driftScore = 0;
  recentTags.forEach(tag => {
    const historicalWeight = historicalProfile.get(tag.toLowerCase()) || 0;
    if (historicalWeight < 0.05) {
      driftScore += 1;
    }
  });

  return (driftScore / recentTags.length) > threshold;
}

// ==================== 6. 主推荐函数 ====================

export function generateRecommendations(
  papers: Paper[],
  preferences: UserPreferences,
  feedback?: UserFeedback,
  options: {
    maxResults?: number;
    excludeRead?: boolean;
    timeRange?: string;
    enableDiversity?: boolean;
    enableExploration?: boolean;
  } = {}
): RecommendationResult {
  const {
    maxResults = 20,
    excludeRead = false,
    timeRange = 'all',
    enableDiversity = true,
    enableExploration = false
  } = options;

  let candidatePapers = papers;

  if (excludeRead && feedback) {
    candidatePapers = candidatePapers.filter(p =>
      !feedback.readPapers.has(p.id) &&
      !feedback.noRecommendPapers.has(p.id)
    );
  }

  const scoredPapers: ScoredPaper[] = candidatePapers.map(paper => {
    const contentScore = feedback
      ? calculateContentSimilarityFromHistory(paper, feedback)
      : calculateBasicContentScore(paper, preferences);

    const preferenceScore = calculatePreferenceScore(paper, preferences, feedback);
    const freshnessScore = calculateFreshnessScore(paper, timeRange);

    const score =
      contentScore * RECOMMENDATION_CONFIG.CONTENT_WEIGHT +
      preferenceScore * RECOMMENDATION_CONFIG.PREFERENCE_WEIGHT +
      freshnessScore * RECOMMENDATION_CONFIG.FRESHNESS_WEIGHT;

    return {
      paper,
      score,
      contentScore,
      preferenceScore,
      freshnessScore,
      diversityScore: 0,
    };
  });

  scoredPapers.sort((a, b) => b.score - a.score);

  let finalPapers = scoredPapers;
  if (enableDiversity) {
    finalPapers = applyDiversityMMR(scoredPapers, maxResults);
  }

  if (enableExploration) {
    finalPapers = epsilonGreedyChoice(finalPapers);
  }

  return {
    papers: finalPapers.slice(0, maxResults).map(sp => sp.paper),
    scores: finalPapers.slice(0, maxResults).map(sp => ({
      paperId: sp.paper.id,
      totalScore: sp.score,
      contentScore: sp.contentScore,
      preferenceScore: sp.preferenceScore,
      freshnessScore: sp.freshnessScore,
    })),
    totalAvailable: candidatePapers.length,
    metadata: {
      generatedAt: new Date().toISOString(),
      algorithm: 'hybrid-mmr-ema',
      config: RECOMMENDATION_CONFIG,
    },
  };
}

function calculateContentSimilarityFromHistory(
  paper: Paper,
  feedback: UserFeedback
): number {
  if (feedback.savedPapers.size === 0) {
    return calculateBasicContentScore(paper, { keywords: [], authors: [], categories: [], timeRange: 'all', sources: [], venues: [] });
  }

  let maxSimilarity = 0;
  let totalSimilarity = 0;
  let count = 0;

  feedback.savedPapers.forEach((fb) => {
    const historyTags = new Set(fb.tags.map(t => t.toLowerCase()));
    const paperTags = new Set(paper.tags.map(t => t.toLowerCase()));

    const intersection = new Set([...historyTags].filter(x => paperTags.has(x)));
    const union = new Set([...historyTags, ...paperTags]);
    const jaccard = intersection.size / union.size;

    totalSimilarity += jaccard;
    maxSimilarity = Math.max(maxSimilarity, jaccard);
    count++;
  });

  return maxSimilarity * 0.6 + (totalSimilarity / count) * 0.4;
}

function calculateBasicContentScore(
  paper: Paper,
  preferences: UserPreferences
): number {
  if (preferences.keywords.length === 0) return 0.5;

  const paperText = `${paper.title} ${paper.abstract || ''} ${paper.tags.join(' ')}`.toLowerCase();
  let matches = 0;
  for (const kw of preferences.keywords) {
    if (paperText.includes(kw.toLowerCase())) {
      matches++;
    }
  }

  return matches / preferences.keywords.length;
}

// ==================== 7. 冷启动解决方案 ====================

export function coldStartRecommendations(
  papers: Paper[],
  keywords: string[] = RECOMMENDATION_CONFIG.COLD_START_KEYWORDS,
  maxResults: number = 20
): Paper[] {
  const recentPapers = [...papers]
    .filter(p => p.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())
    .slice(0, maxResults / 2);

  const keywordPapers = papers
    .filter(p => {
      const text = `${p.title} ${p.abstract || ''} ${p.tags.join(' ')}`.toLowerCase();
      return keywords.some(kw => text.includes(kw.toLowerCase()));
    })
    .slice(0, Math.ceil(maxResults * 0.3));

  const otherPapers = papers
    .filter(p => !recentPapers.includes(p) && !keywordPapers.includes(p))
    .slice(0, Math.ceil(maxResults * 0.2));

  const combined = [...recentPapers, ...keywordPapers, ...otherPapers];
  const unique = combined.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

  return unique.slice(0, maxResults);
}

// ==================== 8. 评估指标 ====================

export function evaluateRecommendations(
  recommendations: Paper[],
  relevantPapers: Paper[],
  allPapers: Paper[]
): EvaluationMetrics {
  const relevantIds = new Set(relevantPapers.map(p => p.id));

  let tp = 0;
  recommendations.forEach(p => {
    if (relevantIds.has(p.id)) tp++;
  });
  const precision = recommendations.length > 0 ? tp / recommendations.length : 0;
  const recall = relevantIds.size > 0 ? tp / relevantIds.size : 0;
  const f1Score = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  const allTags = recommendations.flatMap(p => p.tags);
  const uniqueTags = new Set(allTags);
  const diversity = uniqueTags.size / allTags.length;

  const novelty = recommendations.filter(p => {
    const daysSincePub = p.publishedAt
      ? (Date.now() - new Date(p.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
      : 365;
    return daysSincePub > 30;
  }).length / recommendations.length;

  const coverage = recommendations.length / allPapers.length;

  return { precision, recall, f1Score, diversity, novelty, coverage };
}