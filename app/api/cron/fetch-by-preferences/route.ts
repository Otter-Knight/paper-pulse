import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";

interface ArxivEntry {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  pdfUrl: string;
}

// 根据用户偏好构建arXiv查询
function buildArxivQuery(preferences: {
  keywords: string[];
  authors: string[];
  categories: string[];
  timeRange: string;
}): string[] {
  const queries: string[] = [];

  // 如果有关键词，基于关键词构建查询
  if (preferences.keywords.length > 0) {
    const keywordQuery = preferences.keywords
      .map(kw => `all:${encodeURIComponent(kw)}`)
      .join("+AND+");
    queries.push(keywordQuery);
  }

  // 如果有作者
  if (preferences.authors.length > 0) {
    const authorQuery = preferences.authors
      .map(au => `au:${encodeURIComponent(au)}`)
      .join("+OR+");
    queries.push(`(${authorQuery})`);
  }

  // 如果有分类，优先使用分类
  if (preferences.categories.length > 0) {
    const categoryQueries = preferences.categories.map(cat => {
      // 映射中文分类到arXiv分类
      const categoryMap: Record<string, string> = {
        "计算机视觉": "cs.CV",
        "自然语言处理": "cs.CL",
        "机器学习": "cs.LG",
        "人工智能": "cs.AI",
        "神经网络": "cs.NE",
        "语音": "cs.HO",
        "机器人": "cs.RO",
        "计算语言学": "cs.CL",
        "多模态": "cs.MM",
      };
      return categoryMap[cat] || `cat:${encodeURIComponent(cat)}`;
    });

    if (queries.length > 0) {
      queries[0] += `+AND+(${categoryQueries.join("+OR+")})`;
    } else {
      queries.push(categoryQueries.join("+OR+"));
    }
  }

  // 如果没有关键词和分类，默认使用主要CS分类
  if (queries.length === 0) {
    queries.push("cat:cs.CV+OR+cat:cs.CL+OR+cat:cs.LG+OR+cat:cs.AI+OR+cat:cs.NE");
  }

  return queries;
}

// 添加时间范围
function addTimeRange(query: string, timeRange: string): string {
  const now = new Date();
  let afterDate = "";

  switch (timeRange) {
    case "3months":
      now.setMonth(now.getMonth() - 3);
      break;
    case "6months":
      now.setMonth(now.getMonth() - 6);
      break;
    case "1year":
      now.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return query;
  }

  const dateStr = now.toISOString().split("T")[0];
  return `${query}+AND+submittedDate:[${dateStr}+TO+99991231]`;
}

// 根据查询获取论文
async function fetchArxivByQuery(query: string, maxResults: number = 50): Promise<ArxivEntry[]> {
  const papers: ArxivEntry[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });

  try {
    const url = `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;
    console.log(`Fetching arXiv: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch arXiv: ${response.statusText}`);
      return papers;
    }

    const xmlText = await response.text();
    const result = parser.parse(xmlText);
    const entries = result.feed?.entry;

    if (!entries) return papers;

    const entryArray = Array.isArray(entries) ? entries : [entries];

    entryArray.forEach((entry: any) => {
      const id = (entry.id || "").replace("http://arxiv.org/abs/", "");
      const title = (entry.title || "").replace(/\n/g, " ").trim();
      const abstract = (entry.summary || "").replace(/\n/g, " ").trim();
      const published = entry.published || "";

      const authors = Array.isArray(entry.author)
        ? entry.author.map((a: any) => a.name || "")
        : [];

      let pdfUrl = "";
      const links = Array.isArray(entry.link) ? entry.link : [entry.link].filter(Boolean);
      const pdfLink = links.find((l: any) => l["@_title"] === "pdf");
      if (pdfLink) {
        pdfUrl = pdfLink["@_href"] || "";
      }

      papers.push({
        id,
        title,
        authors,
        abstract,
        published,
        pdfUrl,
      });
    });
  } catch (error) {
    console.error(`Error fetching arXiv for query ${query}:`, error);
  }

  return papers;
}

// 使用LLM提取中文关键词
async function extractTagsWithLLM(title: string, abstract: string): Promise<string[]> {
  try {
    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [
          {
            role: "system",
            content: `你是一个专业的学术论文关键词提取助手。根据论文的标题和摘要，提取5-8个精准的中文关键词/标签。

要求：
1. 关键词要具体、细致，不要泛泛的词
2. 只使用中文标签
3. 包含但不限于以下类型：
   - 具体任务：如"目标检测"、"语义分割"、"命名实体识别"、"图像生成"、"机器翻译"、"视觉问答"等
   - 模型架构：如"Transformer"、"CNN"、"GAN"、"扩散模型"、"BERT"、"GPT"、"ViT"等
   - 技术方法：如"对比学习"、"知识蒸馏"、"少样本学习"、"迁移学习"、"自监督"等
   - 应用领域：如"自动驾驶"、"医疗影像"、"人脸识别"、"推荐系统"等
4. 只要最相关、最精准的关键词
5. 只输出关键词，用逗号分隔，不要有其他内容`
          },
          {
            role: "user",
            content: `标题：${title}\n\n摘要：${abstract.slice(0, 1500)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const tags = content
      .split(/[,，、\n]/)
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0 && tag.length < 20)
      .slice(0, 8);

    return tags;
  } catch (error) {
    console.error("LLM提取关键词失败:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords = [], authors = [], categories = [], timeRange = "all", minPapers = 300 } = body;

    console.log("Fetching papers with preferences:", { keywords, authors, categories, timeRange, minPapers });

    // 构建查询
    const baseQueries = buildArxivQuery({ keywords, authors, categories, timeRange });

    // 添加时间范围
    const queriesWithTime = baseQueries.map(q => addTimeRange(q, timeRange));

    console.log("ArXiv queries:", queriesWithTime);

    const allPapers: ArxivEntry[] = [];
    const maxResultsPerQuery = Math.ceil(minPapers / queriesWithTime.length) + 10;

    // 并行获取所有查询结果
    const fetchPromises = queriesWithTime.map(query => fetchArxivByQuery(query, maxResultsPerQuery));
    const results = await Promise.all(fetchPromises);

    results.forEach(papers => {
      allPapers.push(...papers);
    });

    // 去重
    const uniquePapers = allPapers.filter((paper, index, self) =>
      index === self.findIndex(p => p.id === paper.id)
    );

    console.log(`Found ${uniquePapers.length} unique papers`);

    let papersProcessed = 0;
    let papersSkipped = 0;

    for (const paper of uniquePapers) {
      // 检查是否已存在
      const existing = await prisma.paper.findFirst({
        where: { sourceUrl: { contains: paper.id } },
      });

      if (existing) {
        papersSkipped++;
        continue;
      }

      // 提取关键词
      let tags: string[] = [];
      try {
        tags = await extractTagsWithLLM(paper.title, paper.abstract);
      } catch (e) {
        console.error("Tag extraction failed:", e);
      }

      // 保存到数据库
      try {
        await prisma.paper.create({
          data: {
            title: paper.title,
            authors: paper.authors,
            abstract: paper.abstract,
            source: "arxiv",
            sourceUrl: `https://arxiv.org/abs/${paper.id}`,
            pdfUrl: paper.pdfUrl,
            tags,
            highlights: [],
            publishedAt: new Date(paper.published),
          },
        });
      } catch (e) {
        console.error("Paper creation failed:", e);
        continue;
      }

      papersProcessed++;

      // 达到目标数量后停止
      if (papersProcessed >= minPapers) {
        break;
      }
    }

    console.log(`Processed: ${papersProcessed}, Skipped: ${papersSkipped}`);

    return NextResponse.json({
      message: "Papers fetched successfully",
      papersProcessed,
      papersSkipped,
      totalFound: uniquePapers.length,
      targetMet: papersProcessed >= minPapers,
    });
  } catch (error) {
    console.error("Error fetching papers by preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch papers" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to fetch papers by preferences",
    example: {
      keywords: ["transformer", "diffusion"],
      authors: ["Yann LeCun"],
      categories: ["计算机视觉"],
      timeRange: "3months",
      minPapers: 300
    }
  });
}