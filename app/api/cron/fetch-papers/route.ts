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
            content: `你是一个专业的学术论文关键词提取助手。根据论文的标题和摘要，提取5-10个精准的关键词/标签。

要求：
1. 关键词要具体、细致，不要泛泛的词
2. 优先使用中文标签，如果英文更准确也可以用英文
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

    // 解析关键词
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

async function extractTags(title: string, abstract: string): Promise<string[]> {
  const text = `${title} ${abstract}`.toLowerCase();
  const tags: string[] = [];

  // ====== 任务类型 (Task Types) ======
  const taskTags = [
    // 视觉任务
    { keyword: "object detection", tag: "目标检测" },
    { keyword: "semantic segmentation", tag: "语义分割" },
    { keyword: "instance segmentation", tag: "实例分割" },
    { keyword: "image classification", tag: "图像分类" },
    { keyword: "image generation", tag: "图像生成" },
    { keyword: "image synthesis", tag: "图像合成" },
    { keyword: "image editing", tag: "图像编辑" },
    { keyword: "pose estimation", tag: "姿态估计" },
    { keyword: "face recognition", tag: "人脸识别" },
    { keyword: "face detection", tag: "人脸检测" },
    { keyword: "image caption", tag: "图像描述" },
    { keyword: "visual question answering", tag: "视觉问答" },
    { keyword: "vqa", tag: "视觉问答" },
    { keyword: "video understanding", tag: "视频理解" },
    { keyword: "video generation", tag: "视频生成" },
    { keyword: "action recognition", tag: "动作识别" },
    { keyword: "tracking", tag: "目标跟踪" },
    { keyword: "re-identification", tag: "重识别" },
    { keyword: "3d reconstruction", tag: "三维重建" },
    { keyword: "depth estimation", tag: "深度估计" },
    { keyword: "scene graph", tag: "场景图" },

    // NLP任务
    { keyword: "machine translation", tag: "机器翻译" },
    { keyword: "text classification", tag: "文本分类" },
    { keyword: "named entity recognition", tag: "命名实体识别" },
    { keyword: "ner", tag: "命名实体识别" },
    { keyword: "question answering", tag: "问答系统" },
    { keyword: "summarization", tag: "文本摘要" },
    { keyword: "text generation", tag: "文本生成" },
    { keyword: "dialogue", tag: "对话系统" },
    { keyword: "chatbot", tag: "对话系统" },
    { keyword: "sentiment analysis", tag: "情感分析" },
    { keyword: "relation extraction", tag: "关系抽取" },
    { keyword: "knowledge graph", tag: "知识图谱" },
    { keyword: "natural language inference", tag: "自然语言推断" },
    { keyword: "nli", tag: "自然语言推断" },
    { keyword: "paraphrase", tag: "复述生成" },
    { keyword: "text matching", tag: "文本匹配" },
    { keyword: "semantic matching", tag: "语义匹配" },

    // 多模态
    { keyword: "multimodal", tag: "多模态" },
    { keyword: "vision language", tag: "视觉语言" },
    { keyword: "visual language", tag: "视觉语言" },
    { keyword: "clip", tag: "CLIP" },
    { keyword: "text-to-image", tag: "文生图" },
    { keyword: "image-to-text", tag: "图生文" },
    { keyword: "stable diffusion", tag: "Stable Diffusion" },
    { keyword: "diffusion model", tag: "扩散模型" },

    // 语音任务
    { keyword: "speech recognition", tag: "语音识别" },
    { keyword: "asr", tag: "语音识别" },
    { keyword: "speech synthesis", tag: "语音合成" },
    { keyword: "tts", tag: "语音合成" },
    { keyword: "speaker recognition", tag: "声纹识别" },
    { keyword: "voice conversion", tag: "声音转换" },

    // 生成任务
    { keyword: "text-to-image", tag: "文生图" },
    { keyword: "text-to-video", tag: "文生视频" },
    { keyword: "image-to-image", tag: "图生图" },
    { keyword: "content generation", tag: "内容生成" },
    { keyword: "code generation", tag: "代码生成" },

    // 推理与思考
    { keyword: "reasoning", tag: "推理" },
    { keyword: "chain-of-thought", tag: "思维链" },
    { keyword: "cot", tag: "思维链" },
    { keyword: "mathematical reasoning", tag: "数学推理" },
    { keyword: "logical reasoning", tag: "逻辑推理" },
    { keyword: "planning", tag: "规划" },

    // 强化学习
    { keyword: "reinforcement learning", tag: "强化学习" },
    { keyword: "rl", tag: "强化学习" },
    { keyword: "game ai", tag: "游戏AI" },
    { keyword: "robotics", tag: "机器人" },
    { keyword: "robot learning", tag: "机器人学习" },
    { keyword: "control", tag: "控制" },

    // 检测与分割
    { keyword: "anomaly detection", tag: "异常检测" },
    { keyword: "change detection", tag: "变化检测" },
    { keyword: "edge detection", tag: "边缘检测" },

    // 其他任务
    { keyword: "recommendation", tag: "推荐系统" },
    { keyword: "information retrieval", tag: "信息检索" },
    { keyword: "information extraction", tag: "信息抽取" },
    { keyword: "graph neural network", tag: "图神经网络" },
    { keyword: "gnn", tag: "图神经网络" },
  ];

  // ====== 模型架构 (Model Architectures) ======
  const modelTags = [
    // Transformer变体
    { keyword: "transformer", tag: "Transformer" },
    { keyword: "attention", tag: "注意力机制" },
    { keyword: "self-attention", tag: "自注意力" },
    { keyword: "cross-attention", tag: "交叉注意力" },
    { keyword: "multi-head attention", tag: "多头注意力" },
    { keyword: "bert", tag: "BERT" },
    { keyword: "gpt", tag: "GPT" },
    { keyword: "gpt-", tag: "GPT" },
    { keyword: "llm", tag: "大语言模型" },
    { keyword: "large language model", tag: "大语言模型" },
    { keyword: "vision transformer", tag: "ViT" },
    { keyword: "vit", tag: "ViT" },
    { keyword: "swin transformer", tag: "Swin Transformer" },
    { keyword: "detr", tag: "DETR" },
    { keyword: "mae", tag: "MAE" },
    { keyword: "bart", tag: "BART" },
    { keyword: "t5", tag: "T5" },
    { keyword: "encoder-decoder", tag: "编码器-解码器" },

    // CNN相关
    { keyword: "convolutional neural network", tag: "CNN" },
    { keyword: "cnn", tag: "CNN" },
    { keyword: "resnet", tag: "ResNet" },
    { keyword: "efficientnet", tag: "EfficientNet" },
    { keyword: "mobilenet", tag: "MobileNet" },
    { keyword: "vgg", tag: "VGG" },
    { keyword: "inception", tag: "Inception" },

    // 生成模型
    { keyword: "gan", tag: "GAN" },
    { keyword: "generative adversarial", tag: "GAN" },
    { keyword: "vae", tag: "VAE" },
    { keyword: "variational autoencoder", tag: "VAE" },
    { keyword: "diffusion", tag: "扩散模型" },
    { keyword: "stable diffusion", tag: "Stable Diffusion" },
    { keyword: "ddpm", tag: "DDPM" },
    { keyword: "ddim", tag: "DDIM" },
    { keyword: "flow-based", tag: "归一化流" },
    { keyword: "normalizing flow", tag: "归一化流" },

    // 循环网络
    { keyword: "lstm", tag: "LSTM" },
    { keyword: "long short-term memory", tag: "LSTM" },
    { keyword: "gru", tag: "GRU" },
    { keyword: "gated recurrent", tag: "GRU" },
    { keyword: "rnn", tag: "循环神经网络" },
    { keyword: "recurrent neural network", tag: "循环神经网络" },

    // 图网络
    { keyword: "graph neural network", tag: "图神经网络" },
    { keyword: "gnn", tag: "图神经网络" },
    { keyword: "gcn", tag: "图卷积网络" },
    { keyword: "graph convolutional", tag: "图卷积网络" },
    { keyword: "gat", tag: "图注意力网络" },
    { keyword: "graph attention", tag: "图注意力网络" },

    // 其他架构
    { keyword: "mlp", tag: "MLP" },
    { keyword: "多层感知机", tag: "MLP" },
    { keyword: "autoencoder", tag: "自编码器" },
    { keyword: "encoder-decoder", tag: "编码器-解码器" },
    { keyword: "u-net", tag: "U-Net" },
    { keyword: "unet", tag: "U-Net" },
    { keyword: "encoder only", tag: "纯编码器" },
    { keyword: "decoder only", tag: "纯解码器" },
  ];

  // ====== 技术与方法 (Techniques & Methods) ======
  const techniqueTags = [
    // 预训练与微调
    { keyword: "pretrain", tag: "预训练" },
    { keyword: "pre-train", tag: "预训练" },
    { keyword: "fine-tuning", tag: "微调" },
    { keyword: "fine tune", tag: "微调" },
    { keyword: "transfer learning", tag: "迁移学习" },
    { keyword: "domain adaptation", tag: "域适应" },
    { keyword: "few-shot", tag: "少样本学习" },
    { keyword: "few shot", tag: "少样本学习" },
    { keyword: "zero-shot", tag: "零样本学习" },
    { keyword: "zero shot", tag: "零样本学习" },
    { keyword: "one-shot", tag: "单样本学习" },
    { keyword: "in-context learning", tag: "上下文学习" },
    { keyword: "icl", tag: "上下文学习" },

    // 对比学习
    { keyword: "contrastive learning", tag: "对比学习" },
    { keyword: "contrastive", tag: "对比学习" },
    { keyword: "simclr", tag: "SimCLR" },
    { keyword: "clip", tag: "对比学习" },
    { keyword: "moco", tag: "MoCo" },

    // 知识蒸馏
    { keyword: "knowledge distillation", tag: "知识蒸馏" },
    { keyword: "distillation", tag: "知识蒸馏" },
    { keyword: "teacher-student", tag: "知识蒸馏" },

    // 持续学习
    { keyword: "continual learning", tag: "持续学习" },
    { keyword: "lifelong learning", tag: "终身学习" },
    { keyword: "catastrophic forgetting", tag: "灾难性遗忘" },

    // 自监督
    { keyword: "self-supervised", tag: "自监督学习" },
    { keyword: "self supervised", tag: "自监督学习" },
    { keyword: "masked autoencoder", tag: "掩码自编码器" },
    { keyword: "mae", tag: "MAE" },

    // 优化方法
    { keyword: "adam", tag: "Adam优化器" },
    { keyword: "sgd", tag: "SGD" },
    { keyword: "optimizer", tag: "优化器" },
    { keyword: "learning rate", tag: "学习率" },
    { keyword: "scheduler", tag: "学习率调度" },
    { keyword: "warmup", tag: "预热" },

    // 正则化
    { keyword: "dropout", tag: "Dropout" },
    { keyword: "batch normalization", tag: "批归一化" },
    { keyword: "layer normalization", tag: "层归一化" },
    { keyword: "weight decay", tag: "权重衰减" },
    { keyword: "regularization", tag: "正则化" },

    // 数据增强
    { keyword: "data augmentation", tag: "数据增强" },
    { keyword: "augmentation", tag: "数据增强" },
    { keyword: "mixup", tag: "MixUp" },
    { keyword: "cutmix", tag: "CutMix" },
    { keyword: "cutout", tag: "CutOut" },

    // 其他技术
    { keyword: "ensemble", tag: "集成学习" },
    { keyword: "knowledge graph", tag: "知识图谱" },
    { keyword: "memory", tag: "记忆机制" },
    { keyword: "retrieval", tag: "检索" },
    { keyword: "rag", tag: "RAG" },
    { keyword: "retrieval-augmented", tag: "检索增强" },
    { keyword: "prompt", tag: "提示学习" },
    { keyword: "prompting", tag: "提示学习" },
    { keyword: "instruction tuning", tag: "指令微调" },
    { keyword: "rlhf", tag: "RLHF" },
    { keyword: "reward model", tag: "奖励模型" },
    { keyword: "ppo", tag: "PPO" },
    { keyword: "dpo", tag: "DPO" },
    { keyword: "direct preference", tag: "DPO" },
  ];

  // ====== 应用领域 (Application Domains) ======
  const domainTags = [
    { keyword: "medical", tag: "医疗" },
    { keyword: "healthcare", tag: "医疗" },
    { keyword: "clinical", tag: "临床" },
    { keyword: "diagnosis", tag: "诊断" },
    { keyword: "biomedical", tag: "生物医学" },
    { keyword: "drug discovery", tag: "药物发现" },
    { keyword: "protein", tag: "蛋白质" },
    { keyword: "molecule", tag: "分子" },
    { keyword: " genomics", tag: "基因组学" },

    { keyword: "autonomous driving", tag: "自动驾驶" },
    { keyword: "self-driving", tag: "自动驾驶" },
    { keyword: "autonomous vehicle", tag: "自动驾驶" },

    { keyword: "financial", tag: "金融" },
    { keyword: "fintech", tag: "金融科技" },
    { keyword: "fraud detection", tag: "欺诈检测" },

    { keyword: "education", tag: "教育" },
    { keyword: "e-learning", tag: "在线教育" },

    { keyword: "legal", tag: "法律" },
    { keyword: "law", tag: "法律" },

    { keyword: "manufacturing", tag: "制造业" },
    { keyword: "industrial", tag: "工业" },
    { keyword: "quality inspection", tag: "质量检测" },

    { keyword: "remote sensing", tag: "遥感" },
    { keyword: "satellite", tag: "卫星图像" },
    { keyword: "aerial", tag: "航拍" },

    { keyword: "security", tag: "安全" },
    { keyword: "surveillance", tag: "监控" },
    { keyword: "privacy", tag: "隐私保护" },

    { keyword: "entertainment", tag: "娱乐" },
    { keyword: "gaming", tag: "游戏" },
    { keyword: "art", tag: "艺术生成" },
  ];

  // ====== 理论 & 基础 (Theory & Foundations) ======
  const theoryTags = [
    { keyword: "optimization", tag: "优化" },
    { keyword: "convergence", tag: "收敛性" },
    { keyword: "generalization", tag: "泛化性" },
    { keyword: "theoretical guarantee", tag: "理论保证" },
    { keyword: "analysis", tag: "分析" },
    { keyword: "empirical", tag: "经验分析" },
    { keyword: "benchmark", tag: "基准测试" },
    { keyword: "evaluation", tag: "评估" },
    { keyword: "performance", tag: "性能" },
    { keyword: "accuracy", tag: "精度" },
    { keyword: "efficiency", tag: "效率" },
    { keyword: "complexity", tag: "复杂度" },
    { keyword: "scalability", tag: "可扩展性" },
  ];

  // ====== 具体模型/数据集 (Specific Models/Datasets) ======
  const specificTags = [
    { keyword: "imagenet", tag: "ImageNet" },
    { keyword: "coco", tag: "COCO" },
    { keyword: "ms-coco", tag: "COCO" },
    { keyword: "voc", tag: "VOC" },
    { keyword: "pascal voc", tag: "VOC" },
    { keyword: "cifar", tag: "CIFAR" },
    { keyword: "mnist", tag: "MNIST" },
    { keyword: "wikitext", tag: "WikiText" },
    { keyword: "glue", tag: "GLUE" },
    { keyword: "superglue", tag: "SuperGLUE" },
    { keyword: "squad", tag: "SQuAD" },
    { keyword: "natural questions", tag: "Natural Questions" },
    { keyword: "mmlu", tag: "MMLU" },
    { keyword: "humaneval", tag: "HumanEval" },
    { keyword: "mbpp", tag: "MBPP" },
    { keyword: "codex", tag: "Codex" },
    { keyword: "gpt-4", tag: "GPT-4" },
    { keyword: "gpt-3", tag: "GPT-3" },
    { keyword: "gpt-3.5", tag: "GPT-3.5" },
    { keyword: "llama", tag: "LLaMA" },
    { keyword: "llama-", tag: "LLaMA" },
    { keyword: "mistral", tag: "Mistral" },
    { keyword: "mixtral", tag: "Mixtral" },
    { keyword: "qwen", tag: "Qwen" },
    { keyword: "baichuan", tag: "Baichuan" },
    { keyword: "yi", tag: "Yi" },
    { keyword: "deepseek", tag: "DeepSeek" },
    { keyword: "chatgpt", tag: "ChatGPT" },
    { keyword: "claude", tag: "Claude" },
    { keyword: "gemini", tag: "Gemini" },
    { keyword: "palm", tag: "PaLM" },
    { keyword: "sam", tag: "SAM" },
    { keyword: "segment anything", tag: "SAM" },
    { keyword: "sora", tag: "Sora" },
  ];

  // 合并所有标签类别
  const allTags = [...taskTags, ...modelTags, ...techniqueTags, ...domainTags, ...theoryTags, ...specificTags];

  // 提取标签（去重）
  const extractedTags = new Set<string>();
  for (const { keyword, tag } of allTags) {
    if (text.includes(keyword)) {
      extractedTags.add(tag);
    }
  }

  // 如果没有提取到任何标签，添加基础标签
  if (extractedTags.size === 0) {
    if (text.includes("neural") || text.includes("deep learning")) {
      extractedTags.add("深度学习");
    }
    if (text.includes("machine learning")) {
      extractedTags.add("机器学习");
    }
    if (text.includes("artificial intelligence")) {
      extractedTags.add("人工智能");
    }
    extractedTags.add("其他");
  }

  return Array.from(extractedTags).slice(0, 8); // 最多返回8个标签
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

      // 优先使用LLM提取关键词，如果失败则使用关键词匹配
      let tags = await extractTagsWithLLM(paper.title, paper.abstract);
      if (tags.length === 0) {
        tags = await extractTags(paper.title, paper.abstract);
      }

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
