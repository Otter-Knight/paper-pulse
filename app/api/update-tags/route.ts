import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 使用LLM提取更细致的关键词
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
            content: `你是一个专业的学术论文关键词提取助手。

IMPORTANT: 你必须提取非常具体、细致的中文关键词！

禁止使用以下泛泛的词：
- AI、人工智能、机器学习、深度学习（太泛）
- LLM、大语言模型、NLP、CV（除非论文专门研究这些）

必须使用具体、细化的中文标签，例如：
- 论文研究的具体任务：视频理解、图像生成、目标检测、语义分割、姿态估计、人脸识别、语音识别、机器翻译、文本摘要、命名实体识别、关系抽取、视觉问答、图像编辑、视频生成、动作识别、目标跟踪、场景理解、异常检测等
- 具体模型/方法：Transformer、ViT、Swin、DETR、ResNet、U-Net、GAN、VAE、Stable Diffusion、CLIP、BERT、GPT、LLaMA、扩散模型、对比学习、知识蒸馏等
- 具体应用场景：自动驾驶、医疗影像、卫星遥感、机器人控制、游戏AI、推荐系统、人机交互等

只输出5-8个最相关的中文关键词，用逗号分隔。`
          },
          {
            role: "user",
            content: `标题：${title}\n\n摘要：${abstract?.slice(0, 1500) || ""}`
          }
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // 解析关键词 - 全部转为中文
    const tags = content
      .split(/[,，、\n]/)
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0 && tag.length < 20)
      .slice(0, 10);

    return tags;
  } catch (error) {
    console.error("LLM提取关键词失败:", error);
    return [];
  }
}

export async function POST() {
  try {
    // 获取所有论文
    const papers = await prisma.paper.findMany({
      take: 100
    });

    console.log(`需要更新关键词的论文数量: ${papers.length}`);

    let updated = 0;
    for (const paper of papers) {
      // 使用LLM提取关键词
      let tags = await extractTagsWithLLM(paper.title, paper.abstract || "");

      // 如果LLM失败，使用fallback - 全部用中文
      if (tags.length === 0) {
        const text = `${paper.title} ${paper.abstract || ""}`.toLowerCase();
        tags = [];
        if (text.includes("transformer")) tags.push("Transformer");
        if (text.includes("diffusion")) tags.push("扩散模型");
        if (text.includes("gan")) tags.push("GAN");
        if (text.includes("reinforcement")) tags.push("强化学习");
        if (text.includes("vision") || text.includes("image") || text.includes("video")) tags.push("计算机视觉");
        if (text.includes("language") || text.includes("text") || text.includes("nlp")) tags.push("自然语言处理");
        if (text.includes("speech") || text.includes("audio")) tags.push("语音识别");
        if (text.includes("robotics") || text.includes("robot")) tags.push("机器人");
        if (text.includes("3d") || text.includes("point cloud")) tags.push("三维视觉");
        if (text.includes("graph")) tags.push("图神经网络");
        if (tags.length === 0) tags = ["其他"];
      }

      // 更新论文标签
      await prisma.paper.update({
        where: { id: paper.id },
        data: { tags }
      });

      updated++;
      console.log(`已更新 ${paper.title.slice(0, 30)}... 的标签: ${tags.join(", ")}`);
    }

    return NextResponse.json({ message: "关键词更新完成", updated });
  } catch (error) {
    console.error("更新关键词失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}