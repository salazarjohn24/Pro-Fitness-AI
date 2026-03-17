import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";

const DAY_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getLocalToday(): string {
  return getLocalDateStr(new Date());
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === getLocalToday()) return "Today";
  if (dateStr === getLocalDateStr(yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (date: string) => void;
  maxDaysBack?: number;
}

export function DatePickerSheet({
  visible,
  value,
  onClose,
  onSelect,
  maxDaysBack = 365,
}: Props) {
  const todayStr = getLocalToday();
  const today = new Date();

  const getInitialYear = () => {
    const d = value ? new Date(value + "T12:00:00") : today;
    return d.getFullYear();
  };
  const getInitialMonth = () => {
    const d = value ? new Date(value + "T12:00:00") : today;
    return d.getMonth();
  };

  const [viewYear, setViewYear] = useState(getInitialYear);
  const [viewMonth, setViewMonth] = useState(getInitialMonth);

  useEffect(() => {
    if (visible) {
      setViewYear(getInitialYear());
      setViewMonth(getInitialMonth());
    }
  }, [visible, value]);

  const minDate = new Date();
  minDate.setDate(today.getDate() - maxDaysBack);
  const minDateStr = getLocalDateStr(minDate);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
  const startDow = firstOfMonth.getDay();
  const totalDays = lastOfMonth.getDate();

  const monthLabel = firstOfMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const canGoPrev = (() => {
    const prev = new Date(viewYear, viewMonth - 1, 1);
    const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    return prev >= minMonth;
  })();

  const canGoNext = (() => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return next <= thisMonth;
  })();

  const goPrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayPress = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${mm}-${dd}`;
    if (dateStr > todayStr || dateStr < minDateStr) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(dateStr);
    onClose();
  };

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.overline}>LOG FOR DATE</Text>
          <Text style={styles.title}>
            Pick a <Text style={styles.accent}>date</Text>
          </Text>

          <View style={styles.monthNav}>
            <Pressable
              onPress={goPrev}
              disabled={!canGoPrev}
              style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
              hitSlop={12}
            >
              <Feather
                name="chevron-left"
                size={20}
                color={canGoPrev ? Colors.text : Colors.border}
              />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              onPress={goNext}
              disabled={!canGoNext}
              style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
              hitSlop={12}
            >
              <Feather
                name="chevron-right"
                size={20}
                color={canGoNext ? Colors.text : Colors.border}
              />
            </Pressable>
          </View>

          <View style={styles.dayHeaders}>
            {DAY_HEADERS.map((d) => (
              <Text key={d} style={styles.dayHeaderText}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) {
                return <View key={`empty-${i}`} style={styles.cell} />;
              }
              const mm = String(viewMonth + 1).padStart(2, "0");
              const dd = String(day).padStart(2, "0");
              const dateStr = `${viewYear}-${mm}-${dd}`;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              const isDisabled = dateStr > todayStr || dateStr < minDateStr;

              return (
                <Pressable
                  key={`day-${day}`}
                  onPress={() => !isDisabled && handleDayPress(day)}
                  style={[
                    styles.cell,
                    isSelected && styles.cellSelected,
                    isToday && !isSelected && styles.cellToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      isSelected && styles.cellTextSelected,
                      isToday && !isSelected && styles.cellTextToday,
                      isDisabled && styles.cellTextDisabled,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  overline: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    fontStyle: "italic",
    marginBottom: 20,
  },
  accent: { color: Colors.orange },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  monthLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  dayHeaders: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "14.285714%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  cellSelected: {
    backgroundColor: Colors.orange,
  },
  cellToday: {
    backgroundColor: "rgba(246,234,152,0.12)",
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.4)",
  },
  cellText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  cellTextSelected: {
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  cellTextToday: {
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
  },
  cellTextDisabled: {
    color: Colors.border,
  },
});
