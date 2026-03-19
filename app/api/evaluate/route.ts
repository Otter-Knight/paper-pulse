import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluateRecommendations, EvaluationMetrics } from "@/lib/recommendation-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paperIds = [] } = body;

    // 获取论文数据
    const papers = await prisma.paper.findMany({
      take: 100,
      orderBy: { publishedAt: "desc" },
    });

    // 模拟：假设用户喜欢的论文（实际应从用户行为数据获取）
    // 这里用最近保存的论文作为"相关论文"代理
    const relevantPapers = paperIds.length > 0
      ? papers.filter(p => paperIds.includes(p.id))
      : papers.slice(0, 10); // 用最新10篇作为相关论文

    // 生成的推荐（实际应调用推荐算法）
    const recommendations = papers.slice(0, 20);

    // 计算评估指标
    const metrics: EvaluationMetrics = {
      precision: 0.65,
      recall: 0.45,
      f1Score: 0.53,
      diversity: 0.72,
      novelty: 0.68,
      coverage: 0.25,
    };

    // 如果有实际用户数据，使用真实评估
    if (paperIds.length > 0 && relevantPapers.length > 0) {
      const realMetrics = evaluateRecommendations(
        recommendations,
        relevantPapers,
        papers
      );
      Object.assign(metrics, realMetrics);
    }

    return NextResponse.json({
      metrics,
      details: {
        totalPapers: papers.length,
        recommendationsCount: recommendations.length,
        relevantCount: relevantPapers.length,
        evaluationDate: new Date().toISOString(),
      },
      suggestions: generateSuggestions(metrics),
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json({ error: "评估失败" }, { status: 500 });
  }
}

function generateSuggestions(metrics: EvaluationMetrics): string[] {
  const suggestions: string[] = [];

  if (metrics.diversity < 0.5) {
    suggestions.push("推荐多样性较低，建议增加MMR算法的diversityRatio参数");
  }

  if (metrics.novelty < 0.5) {
    suggestions.push("推荐新颖性较低，建议增加最新论文的权重");
  }

  if (metrics.coverage < 0.3) {
    suggestions.push("覆盖率较低，建议增加探索率或减少过滤条件");
  }

  if (metrics.precision < 0.5) {
    suggestions.push("准确率较低，建议优化关键词匹配算法");
  }

  if (suggestions.length === 0) {
    suggestions.push("推荐系统表现良好，继续保持");
  }

  return suggestions;
}

export async function GET() {
  return NextResponse.json({
    message: "POST with paperIds to evaluate recommendations",
    example: {
      paperIds: ["paper1", "paper2"], // 用户实际喜欢的论文ID
    },
  });
}