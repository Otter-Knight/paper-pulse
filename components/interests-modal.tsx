"use client";

import { useState, useEffect } from "react";
import { Settings, X, Clock, BookOpen, Tag, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PreferenceBuilder, PreferenceTagCard, generatePreferenceSuggestions } from "./preference-builder";
import { usePreferenceStore, getSelectedKeywords, getSelectedVenues, getSelectedAuthors } from "@/lib/preference-store";

interface InterestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (preferences: {
    keywords: string[];
    authors: string[];
    categories: string[];
    timeRange: string;
    sources: string[];
    venues: string[];
  }) => void;
  initialPreferences?: {
    keywords: string[];
    authors: string[];
    categories: string[];
    timeRange?: string;
    sources?: string[];
    venues?: string[];
  };
}

const TIME_OPTIONS = [
  { value: "all", label: "全部时间" },
  { value: "3months", label: "3个月内" },
  { value: "6months", label: "6个月内" },
  { value: "1year", label: "1年内" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "全部来源" },
  { value: "arxiv", label: "arXiv" },
  { value: "openreview", label: "OpenReview" },
];

export function InterestsModal({
  open,
  onOpenChange,
  onSave,
  initialPreferences,
}: InterestsModalProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState("all");
  const [sources, setSources] = useState<string[]>(["all"]);
  const [activeTab, setActiveTab] = useState<"cards" | "manual">("cards");

  const [keywordInput, setKeywordInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");

  // Use preference store
  const { cards, selectedCardIds, toggleCardSelection } = usePreferenceStore();

  // Get aggregated preferences from selected cards
  const cardKeywords = getSelectedKeywords(cards, selectedCardIds);
  const cardVenues = getSelectedVenues(cards, selectedCardIds);
  const cardAuthors = getSelectedAuthors(cards, selectedCardIds);

  useEffect(() => {
    if (initialPreferences) {
      setKeywords(initialPreferences.keywords);
      setAuthors(initialPreferences.authors);
      setCategories(initialPreferences.categories);
      setVenues(initialPreferences.venues || []);
      setTimeRange(initialPreferences.timeRange || "all");
      setSources(initialPreferences.sources || ["all"]);
    }
  }, [initialPreferences, open]);

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const addAuthor = () => {
    if (authorInput.trim() && !authors.includes(authorInput.trim())) {
      setAuthors([...authors, authorInput.trim()]);
      setAuthorInput("");
    }
  };

  const addCategory = () => {
    if (categoryInput.trim() && !categories.includes(categoryInput.trim())) {
      setCategories([...categories, categoryInput.trim()]);
      setCategoryInput("");
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const removeAuthor = (index: number) => {
    setAuthors(authors.filter((_, i) => i !== index));
  };

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const [venueInput, setVenueInput] = useState("");

  const addVenue = () => {
    if (venueInput.trim() && !venues.includes(venueInput.trim())) {
      setVenues([...venues, venueInput.trim()]);
      setVenueInput("");
    }
  };

  const removeVenue = (index: number) => {
    setVenues(venues.filter((_, i) => i !== index));
  };

  const toggleSource = (value: string) => {
    if (value === "all") {
      setSources(["all"]);
    } else {
      const newSources = sources.filter(s => s !== "all");
      if (newSources.includes(value)) {
        const filtered = newSources.filter(s => s !== value);
        setSources(filtered.length === 0 ? ["all"] : filtered);
      } else {
        setSources([...newSources, value]);
      }
    }
  };

  const handleSave = () => {
    // Combine manual keywords with card-based keywords
    const allKeywords = [...new Set([...keywords, ...cardKeywords])];
    const allAuthors = [...new Set([...authors, ...cardAuthors])];
    const allVenues = [...new Set([...venues, ...cardVenues])];

    onSave({
      keywords: allKeywords,
      authors: allAuthors,
      categories,
      timeRange,
      sources,
      venues: allVenues,
    });
    onOpenChange(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent, addFn: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFn();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            个性化设置
          </DialogTitle>
          <DialogDescription>
            自定义你的推荐内容，包括关键词、作者、分类、时间和来源。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Tab Switcher */}
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveTab("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors ${
                activeTab === "cards"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tag className="h-4 w-4" />
              标签卡
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors ${
                activeTab === "manual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="h-4 w-4" />
              手动输入
            </button>
          </div>

          {/* Card-based Preferences */}
          {activeTab === "cards" && (
            <div className="space-y-4">
              {cards.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Tag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">还没有创建标签卡</p>
                  <p className="text-xs mt-1">使用下方 AI 助手创建你的第一个偏好标签卡</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-2">选择已保存的标签卡（可多选）</p>
                  <div className="flex flex-wrap gap-2">
                    {cards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => toggleCardSelection(card.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                          selectedCardIds.includes(card.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {selectedCardIds.includes(card.id) && <Sparkles className="h-3 w-3" />}
                        {card.name}
                        <span className="text-xs opacity-70">({card.keywords.length + card.venues.length})</span>
                      </button>
                    ))}
                  </div>
                  {selectedCardIds.length > 0 && (
                    <div className="mt-3 p-2 bg-muted rounded-md text-xs">
                      <p className="font-medium mb-1">当前选择包含：</p>
                      <p>关键词: {cardKeywords.slice(0, 5).join(", ")}{cardKeywords.length > 5 ? "..." : ""}</p>
                      <p>刊物: {cardVenues.join(", ")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Preference Builder */}
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI 智能创建标签卡
                </p>
                <PreferenceBuilder
                  onGenerate={generatePreferenceSuggestions}
                  onSaveCard={(card) => usePreferenceStore.getState().addCard(card)}
                  existingCards={cards}
                  maxCards={10}
                />
              </div>
            </div>
          )}

          {/* Manual Input */}
          {activeTab === "manual" && (
            <div className="space-y-4">
          {/* Time Range */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              发布时间
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    timeRange === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              来源
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {SOURCE_OPTIONS.map((option) => {
                const isSelected = sources.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleSource(option.value)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="text-sm font-medium mb-2 block">关键词</label>
            <div className="flex gap-2">
              <Input
                placeholder="添加关键词 (如: transformers)"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, addKeyword)}
              />
              <Button onClick={addKeyword} variant="secondary">
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {keywords.map((kw, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm"
                >
                  {kw}
                  <button onClick={() => removeKeyword(index)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Authors */}
          <div>
            <label className="text-sm font-medium mb-2 block">作者</label>
            <div className="flex gap-2">
              <Input
                placeholder="添加作者姓名"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, addAuthor)}
              />
              <Button onClick={addAuthor} variant="secondary">
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {authors.map((author, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-sm"
                >
                  {author}
                  <button onClick={() => removeAuthor(index)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Categories */}
              <div>
                <label className="text-sm font-medium mb-2 block">分类</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="添加分类 (如: NLP)"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addCategory)}
                  />
                  <Button onClick={addCategory} variant="secondary">
                    添加
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.map((cat, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-sm"
                    >
                      {cat}
                      <button onClick={() => removeCategory(index)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

          {/* Venues */}
              <div>
                <label className="text-sm font-medium mb-2 block">发表刊物 (CVPR, NeurIPS, IEEE等)</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="添加刊物 (如: CVPR)"
                    value={venueInput}
                    onChange={(e) => setVenueInput(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addVenue)}
                  />
                  <Button onClick={addVenue} variant="secondary">
                    添加
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {venues.map((venue, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/10 text-purple-600 text-sm"
                    >
                      {venue}
                      <button onClick={() => removeVenue(index)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button onClick={handleSave} className="flex-1">
              保存设置
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
