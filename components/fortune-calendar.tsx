"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface FortuneCalendarProps {
  checkInDates: string[]; // Array of date strings (ISO date only)
}

export function FortuneCalendar({ checkInDates }: FortuneCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and total days in month
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get unique dates from check-in history
  const uniqueDates = useMemo(() => {
    return new Set(checkInDates.map(d => d.split('T')[0]));
  }, [checkInDates]);

  // Get check-in dates for current month (unique)
  const checkInSet = useMemo(() => {
    return uniqueDates;
  }, [uniqueDates]);

  // Calculate stats - count unique dates
  const currentMonthCheckIns = useMemo(() => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    return Array.from(uniqueDates).filter(d => d.startsWith(monthStr)).length;
  }, [uniqueDates, year, month]);

  const totalCheckIns = uniqueDates.size;

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [firstDayOfMonth, daysInMonth]);

  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"
  ];

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <div
      className="w-[340px]"
      style={{
        background: "linear-gradient(145deg, #faf8f5 0%, #f5f0eb 100%)",
        borderRadius: "28px",
        boxShadow: "0 8px 32px rgba(139, 92, 70, 0.12), 0 2px 8px rgba(139, 92, 70, 0.08)",
        padding: "24px",
        minHeight: "380px"
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-amber-100 rounded-full transition-colors"
          style={{ color: "#78716c" }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium" style={{ color: "#44403c" }}>
          {year}年 {monthNames[month]}
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-amber-100 rounded-full transition-colors disabled:opacity-30"
          style={{ color: "#78716c" }}
          disabled={isCurrentMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["日", "一", "二", "三", "四", "五", "六"].map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium"
            style={{ color: "#a8a29e" }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isCheckedIn = checkInSet.has(dateStr);
          const isToday = isCurrentMonth && day === today.getDate();

          return (
            <div
              key={day}
              className={`
                h-8 flex items-center justify-center text-xs rounded-full relative
                ${isCheckedIn ? "font-medium" : ""}
              `}
              style={{
                background: isCheckedIn
                  ? "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)"
                  : isToday
                    ? "rgba(251, 191, 36, 0.15)"
                    : "transparent",
                color: isCheckedIn
                  ? "#fff"
                  : isToday
                    ? "#d97706"
                    : "#78716c",
                boxShadow: isCheckedIn ? "0 2px 8px rgba(245, 158, 11, 0.3)" : "none"
              }}
              title={isCheckedIn ? "今日已求签" : ""}
            >
              {day}
              {isCheckedIn && (
                <Sparkles className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-white" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div
        className="mt-4 pt-4"
        style={{ borderTop: "1px solid #e7e5e4" }}
      >
        <div className="flex items-center justify-between text-xs">
          <div>
            <span style={{ color: "#a8a29e" }}>本月: </span>
            <span className="font-medium" style={{ color: "#44403c" }}>{currentMonthCheckIns} 天</span>
          </div>
          <div>
            <span style={{ color: "#a8a29e" }}>总计: </span>
            <span className="font-medium" style={{ color: "#44403c" }}>{totalCheckIns} 天</span>
          </div>
        </div>
      </div>
    </div>
  );
}
