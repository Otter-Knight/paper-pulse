import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const papers = await prisma.paper.findMany({
      orderBy: { publishedAt: "desc" },
      take: 2000,
    });

    const formatted = papers.map(p => ({
      id: p.id,
      title: p.title,
      authors: p.authors,
      abstract: p.abstract,
      source: p.source,
      sourceUrl: p.sourceUrl,
      pdfUrl: p.pdfUrl,
      tags: p.tags || [],
      highlights: p.highlights || [],
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching papers:", error);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }
}