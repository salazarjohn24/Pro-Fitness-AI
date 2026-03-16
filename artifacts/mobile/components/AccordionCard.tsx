import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

interface Props {
  title: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccordionCard({ title, icon, iconColor, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => {
          Haptics.selectionAsync();
          setOpen(!open);
        }}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <View style={[styles.iconWrap, { backgroundColor: (iconColor ?? Colors.recovery) + "15" }]}>
              <Feather name={icon} size={14} color={iconColor ?? Colors.recovery} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
        </View>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={Colors.textSubtle}
        />
      </Pressable>
      {open && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 2,
    textTransform: "uppercase",
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
});
