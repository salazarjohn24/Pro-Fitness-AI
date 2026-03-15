import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";

interface InsightInfo {
  title: string;
  what: string;
  why: string;
  how: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  insight: InsightInfo | null;
}

export function InsightInfoModal({ visible, onClose, insight }: Props) {
  if (!insight) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Feather name="star" size={18} color={Colors.highlight} />
            </View>
            <Text style={styles.title}>{insight.title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHAT THIS MEANS</Text>
            <Text style={styles.sectionText}>{insight.what}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHY IT MATTERS</Text>
            <Text style={styles.sectionText}>{insight.why}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HOW TO IMPROVE</Text>
            <Text style={styles.sectionText}>{insight.how}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, { opacity: pressed ? 0.9 : 1 }]}
            onPress={onClose}
          >
            <Text style={styles.doneBtnText}>GOT IT</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  card: {
    backgroundColor: "#242422",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(246,234,152,0.2)",
    width: "100%",
    gap: 14,
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(246,234,152,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontStyle: "italic",
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { gap: 5 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.highlight,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  doneBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  doneBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 2,
    fontStyle: "italic",
  },
});
