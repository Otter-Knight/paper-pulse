"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, X, Heart } from "lucide-react";
import { FortuneCalendar } from "./fortune-calendar";

// Fortune levels - warm and poetic
type FortuneLevel = "大吉" | "中吉" | "小吉" | "吉" | "末吉" | "凶";

interface FortuneDetail {
  level: FortuneLevel;
  title: string;
  message: string;
  poem: string;
  advice: string;
  luckyItem: string;
  luckyNumber: number;
  gradient: string;
  accentColor: string;
}

// Poetic fortune messages - warm and inspiring
const fortuneDetails: FortuneDetail[] = [
  {
    level: "大吉",
    title: "上上签 · 大吉",
    message: "🌊 今日科研运势：大吉。深海中自有明珠，",
    poem: "坚持阅读第三篇，灵感将在午后降临。",
    advice: "宜开启新课题、撰写重要论文",
    luckyItem: "金色书签",
    luckyNumber: 8,
    gradient: "linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #fbcfe8 100%)",
    accentColor: "#db2777"
  },
  {
    level: "中吉",
    title: "上签 · 中吉",
    message: "🌅 今日科研运势：中吉。晨光正好，",
    poem: "思维如清泉流淌，难题自会瓦解。",
    advice: "宜处理遗留问题、规划研究路线",
    luckyItem: "青色笔记本",
    luckyNumber: 6,
    gradient: "linear-gradient(135deg, #ecfeff 0%, #cffafe 50%, #a5f3fc 100%)",
    accentColor: "#0891b2"
  },
  {
    level: "小吉",
    title: "中签 · 小吉",
    message: "🍃 今日科研运势：小吉。稳步前行，",
    poem: "每一步都算数，积累终将绽放。",
    advice: "宜常规阅读、整理文献笔记",
    luckyItem: "绿色多肉",
    luckyNumber: 3,
    gradient: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
    accentColor: "#16a34a"
  },
  {
    level: "吉",
    title: "下签 · 吉",
    message: "🌤️ 今日科研运势：吉。云淡风轻，",
    poem: "寻常日子也有细微美好值得发现。",
    advice: "宜基础工作、团队协作交流",
    luckyItem: "蓝色咖啡杯",
    luckyNumber: 5,
    gradient: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)",
    accentColor: "#2563eb"
  },
  {
    level: "末吉",
    title: "下下签 · 末吉",
    message: "🌙 今日科研运势：末吉。静夜有月，",
    poem: "不如放慢脚步，让身心稍作休憩。",
    advice: "宜轻松浏览、学习新工具",
    luckyItem: "紫色薰衣草",
    luckyNumber: 2,
    gradient: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%)",
    accentColor: "#9333ea"
  },
  {
    level: "凶",
    title: "凶签",
    message: "🌫️ 今日科研运势：凶。山高路远，",
    poem: "风雪之时，静待天晴亦是智慧。",
    advice: "宜充电学习、阅读经典著作",
    luckyItem: "灰色暖手宝",
    luckyNumber: 1,
    gradient: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
    accentColor: "#64748b"
  },
];

// Generate unique fortune based on user + date
function generateDailyFortune(userId: string, date: Date): FortuneDetail {
  const dateStr = date.toISOString().split("T")[0];
  const userHash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Weighted random - more good fortunes
  const weights = [20, 25, 25, 15, 10, 5];
  const total = weights.reduce((a, b) => a + b, 0);

  const randomOffset = Math.floor(Math.random() * 100);
  let random = (userHash + randomOffset) % total;

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return fortuneDetails[i];
  }
  return fortuneDetails[0];
}

export function FortuneCheckIn() {
  const [fortune, setFortune] = useState<FortuneDetail | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFortune, setShowFortune] = useState(false);
  const [checkInDates, setCheckInDates] = useState<string[]>([]);
  const [canReset, setCanReset] = useState(false);
  const [userId] = useState(() => {
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("paperpulse_user_id");
      if (!id) {
        id = "user_" + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("paperpulse_user_id", id);
      }
      return id;
    }
    return "default_user";
  });

  // Load check-in dates on mount
  useEffect(() => {
    const saved = localStorage.getItem("fortune_checkin_dates");
    if (saved) {
      try {
        setCheckInDates(JSON.parse(saved));
      } catch {
        setCheckInDates([]);
      }
    }
  }, []);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastCheckIn = localStorage.getItem("fortune_checkin_date");
    const savedFortune = localStorage.getItem("fortune_result");

    if (lastCheckIn === today && savedFortune) {
      try {
        setFortune(JSON.parse(savedFortune));
        setCheckedIn(true);
      } catch {
        // Invalid data
      }
    } else if (lastCheckIn && lastCheckIn !== today) {
      // Allow reset if last check-in was not today
      setCanReset(true);
    }
  }, []);

  const handleCheckIn = useCallback(() => {
    setIsAnimating(true);
    setShowFortune(true);

    setTimeout(() => {
      const newFortune = generateDailyFortune(userId, new Date());
      const today = new Date().toISOString().split("T")[0];

      setFortune(newFortune);
      setCheckedIn(true);
      setIsAnimating(false);

      localStorage.setItem("fortune_checkin_date", new Date().toDateString());
      localStorage.setItem("fortune_result", JSON.stringify(newFortune));

      // Use Set to ensure unique dates only
      const uniqueDates = new Set([...checkInDates, today]);
      const newDates = Array.from(uniqueDates);
      setCheckInDates(newDates);
      localStorage.setItem("fortune_checkin_dates", JSON.stringify(newDates));
    }, 2500);
  }, [userId, checkInDates]);

  const handleReset = () => {
    // Only allow reset if it's not today (for testing purposes)
    const lastCheckIn = localStorage.getItem("fortune_checkin_date");
    const today = new Date().toDateString();
    if (lastCheckIn !== today) {
      localStorage.removeItem("fortune_checkin_date");
      localStorage.removeItem("fortune_result");
      setCheckedIn(false);
      setFortune(null);
      setShowFortune(false);
    }
  };

  return (
    <div className="flex gap-6 items-start justify-center flex-wrap">
      {/* Fortune Card */}
      <div className="w-[340px]">
        {!showFortune ? (
          // Initial state
          <div
            className="relative overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #faf8f5 0%, #f5f0eb 100%)",
              borderRadius: "28px",
              boxShadow: "0 8px 32px rgba(139, 92, 70, 0.12), 0 2px 8px rgba(139, 92, 70, 0.08)",
              padding: "40px 32px",
              minHeight: "380px"
            }}
          >
            {/* Decorative elements */}
            <div
              className="absolute top-0 right-0 w-32 h-32 opacity-30"
              style={{
                background: "radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)",
                borderRadius: "50%",
                transform: "translate(30%, -30%)"
              }}
            />

            <div className="relative z-10 text-center">
              {/* Icon */}
              <div
                className="w-16 h-16 mx-auto mb-5 flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)",
                  borderRadius: "20px",
                  boxShadow: "0 4px 16px rgba(245, 158, 11, 0.3)"
                }}
              >
                <Sparkles className="w-7 h-7 text-white" />
              </div>

              {/* Title */}
              <h3
                className="text-xl font-semibold mb-2"
                style={{ color: "#44403c" }}
              >
                今日运势
              </h3>

              {/* Subtitle */}
              <p
                className="text-sm mb-8 leading-relaxed"
                style={{ color: "#78716c" }}
              >
                点燃这支签，<br />开启今日的科研之旅
              </p>

              {/* Button */}
              <button
                onClick={handleCheckIn}
                disabled={isAnimating || checkedIn}
                className="relative group"
              >
                <div
                  className="px-12 py-4 rounded-full font-medium transition-all duration-300"
                  style={{
                    background: checkedIn
                      ? "linear-gradient(135deg, #d6d3d1 0%, #a8a29e 100%)"
                      : "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)",
                    color: "#fff",
                    boxShadow: checkedIn ? "none" : "0 4px 20px rgba(245, 158, 11, 0.4)",
                    opacity: checkedIn ? 0.7 : 1,
                  }}
                >
                  <span className="text-lg">{checkedIn ? "明日再来" : "求 签"}</span>
                </div>
              </button>

              <p
                className="text-xs mt-6"
                style={{ color: "#a8a29e" }}
              >
                {checkedIn ? "今日已求得 · 明日再来" : "每日一次 · 科研祈福"}
              </p>
            </div>
          </div>
        ) : isAnimating ? (
          // Animating state
          <div
            className="overflow-hidden flex flex-col items-center justify-center"
            style={{
              background: "linear-gradient(145deg, #faf8f5 0%, #f5f0eb 100%)",
              borderRadius: "28px",
              boxShadow: "0 8px 32px rgba(139, 92, 70, 0.12)",
              padding: "60px 32px",
              height: "380px"
            }}
          >
            {/* Animated incense/bamboo */}
            <div className="relative mb-6">
              <div
                className="w-20 h-24 rounded-lg flex items-center justify-center animate-pulse"
                style={{
                  background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)",
                  boxShadow: "0 8px 24px rgba(245, 158, 11, 0.25)"
                }}
              >
                <span className="text-4xl">🎋</span>
              </div>
              {/* Smoke effect */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <div className="w-1 h-8 rounded-full opacity-30 animate-pulse" style={{ background: "#d6d3d1" }} />
              </div>
            </div>

            <p
              className="text-sm animate-pulse"
              style={{ color: "#78716c" }}
            >
              卜算中...
            </p>
          </div>
        ) : fortune ? (
          // Show fortune result - Apple meditation style
          <div
            className="overflow-hidden relative"
            style={{
              background: fortune.gradient,
              borderRadius: "28px",
              boxShadow: "0 12px 48px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.05)",
              padding: "36px 28px",
              minHeight: "380px"
            }}
          >
            {/* Decorative orbs */}
            <div
              className="absolute top-0 right-0 w-40 h-40 opacity-40"
              style={{
                background: `radial-gradient(circle, ${fortune.accentColor}20 0%, transparent 70%)`,
                borderRadius: "50%",
                transform: "translate(40%, -40%)"
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-32 h-32 opacity-30"
              style={{
                background: `radial-gradient(circle, ${fortune.accentColor}30 0%, transparent 70%)`,
                borderRadius: "50%",
                transform: "translate(-30%, 30%)"
              }}
            />

            <div className="relative z-10">
              {/* Close button */}
              <button
                onClick={() => setShowFortune(false)}
                className="absolute top-0 right-0 p-2 rounded-full hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4" style={{ color: fortune.accentColor }} />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-medium mb-4"
                  style={{
                    backgroundColor: `${fortune.accentColor}15`,
                    color: fortune.accentColor
                  }}
                >
                  {fortune.level}
                </div>

                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: fortune.accentColor }}
                >
                  {fortune.title}
                </h3>
              </div>

              {/* Main fortune message */}
              <div className="text-center mb-6">
                <p
                  className="text-sm leading-relaxed mb-3"
                  style={{ color: "#44403c" }}
                >
                  {fortune.message}
                </p>
                <p
                  className="text-base font-medium"
                  style={{ color: fortune.accentColor }}
                >
                  {fortune.poem}
                </p>
              </div>

              {/* Divider */}
              <div
                className="h-px mb-6 mx-auto"
                style={{
                  width: "60px",
                  background: `linear-gradient(90deg, transparent, ${fortune.accentColor}40, transparent)`
                }}
              />

              {/* Lucky info */}
              <div className="flex items-center justify-center gap-8 mb-4">
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#78716c" }}>幸运物</p>
                  <p className="text-sm font-medium" style={{ color: fortune.accentColor }}>
                    {fortune.luckyItem}
                  </p>
                </div>
                <div
                  className="w-px h-8"
                  style={{ backgroundColor: "#d6d3d1" }}
                />
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#78716c" }}>幸运数</p>
                  <p className="text-sm font-medium" style={{ color: fortune.accentColor }}>
                    {fortune.luckyNumber}
                  </p>
                </div>
              </div>

              {/* Advice */}
              <p
                className="text-xs text-center mb-4 px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.6)",
                  color: "#57534e"
                }}
              >
                💡 {fortune.advice}
              </p>

              {/* Date */}
              <p
                className="text-xs text-center"
                style={{ color: "#a8a29e" }}
              >
                {new Date().toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })} · 每日一签
              </p>

              {/* Reset button - only show if allowed (not today) */}
              {canReset && (
                <button
                  onClick={handleReset}
                  className="text-xs mx-auto block mt-3 hover:underline"
                  style={{ color: "#a8a29e" }}
                >
                  重新求签
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Calendar */}
      <div className="flex-shrink-0">
        <FortuneCalendar checkInDates={checkInDates} />
      </div>
    </div>
  );
}
