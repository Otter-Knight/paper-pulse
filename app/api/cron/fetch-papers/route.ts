import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";

const USE_MOCK_DATA = process.env.USE_MOCK_DATA === "true";

interface ArxivEntry {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  pdfUrl: string;
}

async function fetchArxivPapers(): Promise<ArxivEntry[]> {
  const categories = ["cs.CL", "cs.LG", "cs.AI", "cs.NE", "stat.ML"];
  const maxResults = 10;
  const papers: ArxivEntry[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });

  for (const category of categories) {
    try {
      const url = `http://export.arxiv.org/api/query?search_query=cat:${category}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch arXiv for ${category}: ${response.statusText}`);
        continue;
      }

      const xmlText = await response.text();
      const result = parser.parse(xmlText);
      const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry].filter(Boolean);

      entries.forEach((entry: any) => {
        const id = (entry.id || "").replace("http://arxiv.org/abs/", "");
        const title = (entry.title || "").replace(/\n/g, " ").trim();
        const abstract = (entry.summary || "").replace(/\n/g, " ").trim();
        const published = entry.published || "";

        const authors = Array.isArray(entry.author)
          ? entry.author.map((a: any) => a.name || "")
          : [];

        // Find PDF link
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
      console.error(`Error fetching arXiv for ${category}:`, error);
    }
  }

  return papers;
}

// Mock OpenReview papers
function getMockOpenReviewPapers(): ArxivEntry[] {
  return [
    {
      id: "openreview-1",
      title: "A Unified Approach to Reasoning in Large Language Models",
      authors: ["John Doe", "Jane Smith"],
      abstract: "We present a unified framework for reasoning tasks in LLMs that combines chain-of-thought, tree-of-thought, and graph-of-thought approaches into a single coherent method.",
      published: new Date().toISOString(),
      pdfUrl: "https://openreview.net/pdf?id=mock1",
    },
    {
      id: "openreview-2",
      title: "Efficient Training of Large Models on Consumer Hardware",
      authors: ["Alice Brown", "Bob Wilson"],
      abstract: "This paper introduces novel techniques for reducing memory footprint during LLM training, enabling fine-tuning of 70B parameter models on a single GPU.",
      published: new Date(Date.now() - 86400000).toISOString(),
      pdfUrl: "https://openreview.net/pdf?id=mock2",
    },
  ];
}

async function generateHighlights(title: string, abstract: string): Promise<string[]> {
  // In production, call LLM here to generate highlights
  // For now, return mock highlights
  return [
    `Analysis of ${title.split(" ").slice(0, 3).join(" ")}...`,
    "Novel methodology proposed for the task",
    "State-of-the-art results achieved on benchmarks",
  ];
}

async function extractTags(title: string, abstract: string): Promise<string[]> {
  // In production, call LLM here to extract tags
  // For now, use simple keyword matching
  const text = `${title} ${abstract}`.toLowerCase();
  const tagCandidates = [
    "NLP", "Deep Learning", "Transformers", "Computer Vision",
    "Reinforcement Learning", "Machine Learning", "AI", "Language Models",
    "Neural Networks", "Optimization", "Robotics", "Speech"
  ];

  return tagCandidates.filter(tag => text.includes(tag.toLowerCase()));
}

export async function POST(request: NextRequest) {
  // Check authorization
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (USE_MOCK_DATA) {
    return NextResponse.json({
      message: "Mock data mode enabled, skipping fetch",
      papersProcessed: 0,
    });
  }

  try {
    // Fetch from arXiv
    const arxivPapers = await fetchArxivPapers();

    // Get mock OpenReview papers
    const openreviewPapers = getMockOpenReviewPapers();

    const allPapers = [...arxivPapers, ...openreviewPapers];

    let papersProcessed = 0;

    for (const paper of allPapers) {
      // Check if paper already exists
      const existing = await prisma.paper.findFirst({
        where: { sourceUrl: { contains: paper.id } },
      });

      if (existing) {
        continue; // Skip duplicates
      }

      // Generate highlights and tags
      const highlights = await generateHighlights(paper.title, paper.abstract);
      const tags = await extractTags(paper.title, paper.abstract);

      // Save to database
      await prisma.paper.create({
        data: {
          title: paper.title,
          authors: paper.authors,
          abstract: paper.abstract,
          source: paper.id.startsWith("openreview") ? "openreview" : "arxiv",
          sourceUrl: paper.id.startsWith("openreview")
            ? `https://openreview.net/forum?id=${paper.id}`
            : `https://arxiv.org/abs/${paper.id}`,
          pdfUrl: paper.pdfUrl,
          tags,
          highlights,
          publishedAt: new Date(paper.published),
        },
      });

      papersProcessed++;
    }

    return NextResponse.json({
      message: "Papers fetched successfully",
      papersProcessed,
      arxivPapers: arxivPapers.length,
      openreviewPapers: openreviewPapers.length,
    });
  } catch (error) {
    console.error("Error fetching papers:", error);
    return NextResponse.json(
      { error: "Failed to fetch papers" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to trigger paper fetch",
  });
}
