import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";

type FeatherIcon = ComponentProps<typeof Feather>["name"];
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useEnvironments, useCreateEnvironment, useUpdateEnvironment, useActivateEnvironment, useDeleteEnvironment } from "@/hooks/useEnvironments";
import { EquipmentChecklist } from "@/components/EquipmentChecklist";

const FREQUENCIES = [2, 3, 4, 5, 6];

const GYM_TYPES: { label: string; icon: FeatherIcon }[] = [
  { label: "Home Gym", icon: "home" },
  { label: "Commercial Gym", icon: "map-pin" },
  { label: "CrossFit Box", icon: "target" },
  { label: "Other", icon: "grid" },
];

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const GENDERS = ["Male", "Female", "Other"];
const PRIMARY_GOALS = ["Muscle Growth", "Fat Loss", "Strength", "Flexibility \u00B7 Longevity"];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();
  const { data: environments } = useEnvironments();
  const { mutate: activateEnv } = useActivateEnvironment();
  const { mutate: createEnv, isPending: isCreating } = useCreateEnvironment();
  const { mutate: updateEnv, isPending: isUpdating } = useUpdateEnvironment();
  const { mutate: deleteEnv } = useDeleteEnvironment();

  const [editingGeneral, setEditingGeneral] = useState(false);
  const [editAge, setEditAge] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editGoal, setEditGoal] = useState("");

  const [showNewEnvModal, setShowNewEnvModal] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvType, setNewEnvType] = useState("");
  const [newEnvEquipment, setNewEnvEquipment] = useState<Record<string, string[]>>({});

  const [editEnvId, setEditEnvId] = useState<number | null>(null);
  const [editEnvName, setEditEnvName] = useState("");
  const [editEnvType, setEditEnvType] = useState("");
  const [editEnvEquipment, setEditEnvEquipment] = useState<Record<string, string[]>>({});

  const [showInsightInfo, setShowInsightInfo] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logout();
    router.replace("/welcome");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            await logout();
            router.replace("/welcome");
          },
        },
      ]
    );
  };

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.email?.split("@")[0] ?? "Athlete";

  const startEditingGeneral = () => {
    setEditAge(profile?.age?.toString() ?? "");
    setEditWeight(profile?.weight?.toString() ?? "");
    setEditHeight(profile?.height?.toString() ?? "");
    setEditGender(profile?.gender ?? "");
    setEditLevel(profile?.experienceLevel ?? "");
    setEditGoal(profile?.primaryGoal ?? "");
    setEditingGeneral(true);
  };

  const saveGeneral = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({
      age: editAge ? parseInt(editAge) : null,
      weight: editWeight ? parseInt(editWeight) : null,
      height: editHeight ? parseInt(editHeight) : null,
      gender: editGender || null,
      experienceLevel: editLevel || null,
      primaryGoal: editGoal || null,
    });
    setEditingGeneral(false);
  };

  const toggleEquipment = (category: string, item: string) => {
    setNewEnvEquipment((prev) => {
      const catItems = prev[category] ?? [];
      const updated = catItems.includes(item)
        ? catItems.filter((i) => i !== item)
        : [...catItems, item];
      return { ...prev, [category]: updated };
    });
  };

  const handleCreateEnv = () => {
    if (!newEnvName.trim() || !newEnvType) return;
    createEnv(
      { name: newEnvName.trim(), type: newEnvType, equipment: newEnvEquipment, isActive: true },
      {
        onSuccess: () => {
          setShowNewEnvModal(false);
          setNewEnvName("");
          setNewEnvType("");
          setNewEnvEquipment({});
        },
      }
    );
  };

  const startEditEnv = (env: { id: number; name: string; type: string; equipment: Record<string, string[]> }) => {
    setEditEnvId(env.id);
    setEditEnvName(env.name);
    setEditEnvType(env.type);
    setEditEnvEquipment(env.equipment ?? {});
  };

  const toggleEditEquipment = (category: string, item: string) => {
    setEditEnvEquipment((prev) => {
      const catItems = prev[category] ?? [];
      const updated = catItems.includes(item)
        ? catItems.filter((i) => i !== item)
        : [...catItems, item];
      return { ...prev, [category]: updated };
    });
  };

  const handleUpdateEnv = () => {
    if (!editEnvId || !editEnvName.trim() || !editEnvType) return;
    updateEnv(
      { id: editEnvId, name: editEnvName.trim(), type: editEnvType, equipment: editEnvEquipment },
      {
        onSuccess: () => {
          setEditEnvId(null);
          setEditEnvName("");
          setEditEnvType("");
          setEditEnvEquipment({});
        },
      }
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>ATHLETE PROFILE</Text>
      </View>

      <View style={styles.avatarCard}>
        <View style={styles.avatarWrap}>
          {user?.profileImageUrl ? (
            <Image source={{ uri: user.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Feather name="zap" size={10} color={Colors.orange} />
          </View>
        </View>
        <View style={styles.nameArea}>
          <Text style={styles.displayName}>{displayName.toUpperCase()}</Text>
          <Text style={styles.email}>{user?.email ?? ""}</Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberText}>PRO MEMBER</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: "Streak", value: profile?.streakDays ?? 0, unit: "days", color: Colors.orange },
          { label: "Goal", value: (profile?.workoutFrequency ?? 3) + "x", unit: "/week", color: Colors.highlight },
          { label: "Progress", value: profile?.dailySyncProgress ?? 0, unit: "%", color: Colors.recovery },
        ].map(({ label, value, unit, color }) => (
          <View key={label} style={[styles.statCard, { borderColor: color + "25" }]}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statUnit}>{unit}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.auditHeaderRow}>
          <View style={styles.auditHeader}>
            <Text style={styles.auditTitle}>GENERAL INFORMATION</Text>
          </View>
          <Pressable
            onPress={editingGeneral ? saveGeneral : startEditingGeneral}
            style={styles.editBtn}
          >
            <Feather name={editingGeneral ? "check" : "edit-2"} size={14} color={editingGeneral ? Colors.orange : Colors.textSubtle} />
            <Text style={[styles.editBtnText, editingGeneral && { color: Colors.orange }]}>
              {editingGeneral ? "SAVE" : "EDIT"}
            </Text>
          </Pressable>
        </View>

        {!editingGeneral ? (
          <>
            <View style={styles.onboardingGrid}>
              {[
                { label: "Age", value: profile?.age ? `${profile.age} yrs` : "\u2014" },
                { label: "Weight", value: profile?.weight ? `${profile.weight} lbs` : "\u2014" },
                { label: "Height", value: profile?.height ? `${profile.height} in` : "\u2014" },
                { label: "Gender", value: profile?.gender ?? "\u2014" },
                { label: "Level", value: profile?.experienceLevel ?? "\u2014" },
                { label: "Goal", value: profile?.primaryGoal ?? "\u2014" },
              ].map(({ label, value }) => (
                <View key={label} style={styles.onboardingItem}>
                  <Text style={styles.onboardingLabel}>{label}</Text>
                  <Text style={styles.onboardingValue}>{value}</Text>
                </View>
              ))}
            </View>
            {profile?.injuries && profile.injuries.length > 0 && (
              <View style={styles.injuryRow}>
                <Feather name="alert-circle" size={12} color={Colors.orange} />
                <Text style={styles.injuryText}>{profile.injuries.join(", ")}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.editForm}>
            <View style={styles.editRow}>
              <View style={styles.editFieldHalf}>
                <Text style={styles.editFieldLabel}>AGE</Text>
                <TextInput
                  style={styles.editInput}
                  value={editAge}
                  onChangeText={setEditAge}
                  keyboardType="numeric"
                  placeholder="\u2014"
                  placeholderTextColor={Colors.textSubtle}
                  maxLength={3}
                />
              </View>
              <View style={styles.editFieldHalf}>
                <Text style={styles.editFieldLabel}>WEIGHT (LBS)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editWeight}
                  onChangeText={setEditWeight}
                  keyboardType="numeric"
                  placeholder="\u2014"
                  placeholderTextColor={Colors.textSubtle}
                  maxLength={4}
                />
              </View>
            </View>
            <View style={styles.editRow}>
              <View style={styles.editFieldHalf}>
                <Text style={styles.editFieldLabel}>HEIGHT (IN)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editHeight}
                  onChangeText={setEditHeight}
                  keyboardType="numeric"
                  placeholder="\u2014"
                  placeholderTextColor={Colors.textSubtle}
                  maxLength={3}
                />
              </View>
              <View style={styles.editFieldHalf}>
                <Text style={styles.editFieldLabel}>GENDER</Text>
                <View style={styles.editChipRow}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g}
                      style={[styles.editChip, editGender === g && styles.editChipActive]}
                      onPress={() => { Haptics.selectionAsync(); setEditGender(g); }}
                    >
                      <Text style={[styles.editChipText, editGender === g && styles.editChipTextActive]}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>EXPERIENCE LEVEL</Text>
              <View style={styles.editChipRow}>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <Pressable
                    key={lvl}
                    style={[styles.editChip, editLevel === lvl && styles.editChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setEditLevel(lvl); }}
                  >
                    <Text style={[styles.editChipText, editLevel === lvl && styles.editChipTextActive]}>{lvl}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>PRIMARY GOAL</Text>
              <View style={styles.editChipRow}>
                {PRIMARY_GOALS.map((goal) => (
                  <Pressable
                    key={goal}
                    style={[styles.editChip, editGoal === goal && styles.editChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setEditGoal(goal); }}
                  >
                    <Text style={[styles.editChipText, editGoal === goal && styles.editChipTextActive]}>{goal}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>WEEKLY FREQUENCY</Text>
        </View>
        <View style={styles.freqRow}>
          {FREQUENCIES.map((f) => (
            <Pressable
              key={f}
              style={({ pressed }) => [
                styles.freqBtn,
                profile?.workoutFrequency === f && styles.freqBtnActive,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                updateProfile({ workoutFrequency: f });
              }}
            >
              <Text style={[styles.freqBtnText, profile?.workoutFrequency === f && styles.freqBtnTextActive]}>{f}x</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>GYM ENVIRONMENTS</Text>
        </View>
        <Text style={styles.envHint}>Tap an environment to set it as default for AI workout recommendations</Text>
        {environments && environments.length > 0 ? (
          <View style={styles.envList}>
            {environments.map((env) => (
              <View key={env.id} style={[styles.envRow, env.isActive && styles.envRowActive]}>
                <Pressable
                  style={styles.envInfo}
                  onPress={() => {
                    if (!env.isActive) {
                      Haptics.selectionAsync();
                      activateEnv(env.id);
                    }
                  }}
                >
                  <View style={styles.envIconWrap}>
                    <Feather
                      name={env.type === "Home Gym" ? "home" : env.type === "CrossFit Box" ? "target" : "map-pin"}
                      size={16}
                      color={env.isActive ? Colors.orange : Colors.textMuted}
                    />
                  </View>
                  <View style={styles.envTextArea}>
                    <Text style={[styles.envName, env.isActive && styles.envNameActive]}>{env.name}</Text>
                    <Text style={styles.envType}>{env.type}</Text>
                  </View>
                  {env.isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>DEFAULT</Text>
                    </View>
                  )}
                </Pressable>
                <View style={styles.envBtnsRow}>
                  <Pressable
                    style={styles.envEditBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      startEditEnv(env);
                    }}
                  >
                    <Feather name="edit-2" size={14} color={Colors.recovery} />
                  </Pressable>
                  <Pressable
                    style={styles.envDeleteBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      deleteEnv(env.id);
                    }}
                  >
                    <Feather name="trash-2" size={14} color={Colors.textSubtle} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No gym environments set up yet</Text>
        )}
        <Pressable
          style={styles.addEnvBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowNewEnvModal(true);
          }}
        >
          <Feather name="plus" size={16} color={Colors.orange} />
          <Text style={styles.addEnvBtnText}>NEW ENVIRONMENT</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.auditHeaderRow}>
          <View style={styles.auditHeader}>
            <Text style={styles.auditTitle}>INSIGHT PREFERENCES</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setShowInsightInfo(true);
            }}
            style={styles.infoIconBtn}
          >
            <Feather name="info" size={14} color={Colors.textSubtle} />
          </Pressable>
        </View>

        <View style={styles.prefSection}>
          <Text style={styles.prefLabel}>DETAIL LEVEL</Text>
          <View style={styles.toggleRow}>
            {(["simple", "granular"] as const).map((level) => (
              <Pressable
                key={level}
                style={[
                  styles.toggleBtn,
                  profile?.insightDetailLevel === level && styles.toggleBtnActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateProfile({ insightDetailLevel: level });
                }}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    profile?.insightDetailLevel === level && styles.toggleBtnTextActive,
                  ]}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={16} color="#F87171" />
        <Text style={styles.logoutText}>SIGN OUT</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.deleteAccountBtn, { opacity: pressed ? 0.8 : 1 }]}
        onPress={handleDeleteAccount}
      >
        <Feather name="trash-2" size={14} color="#78716C" />
        <Text style={styles.deleteAccountText}>DELETE ACCOUNT</Text>
      </Pressable>

      <Modal
        visible={showInsightInfo}
        animationType="fade"
        transparent
        onRequestClose={() => setShowInsightInfo(false)}
      >
        <Pressable style={styles.insightOverlay} onPress={() => setShowInsightInfo(false)}>
          <View style={styles.insightInfoCard}>
            <View style={styles.insightInfoHeader}>
              <Feather name="info" size={18} color={Colors.orange} />
              <Text style={styles.insightInfoTitle}>INSIGHT DETAIL LEVELS</Text>
            </View>

            <View style={styles.insightInfoSection}>
              <Text style={styles.insightInfoLabel}>SIMPLE</Text>
              <Text style={styles.insightInfoDesc}>
                Get clear, actionable takeaways after each workout. Best for athletes who want quick summaries without data overload.
              </Text>
            </View>

            <View style={styles.insightInfoDivider} />

            <View style={styles.insightInfoSection}>
              <Text style={styles.insightInfoLabel}>GRANULAR</Text>
              <Text style={styles.insightInfoDesc}>
                Receive detailed breakdowns including volume tracking, muscle group balance, recovery trends, and progression curves. Best for data-driven athletes who want to optimize every variable.
              </Text>
            </View>

            <View style={styles.insightInfoDivider} />

            <View style={styles.insightInfoSection}>
              <Text style={styles.insightInfoWhyLabel}>WHY IT MATTERS</Text>
              <Text style={styles.insightInfoDesc}>
                Your detail level controls how the AI presents workout feedback and progress reports. Choosing the right level helps you stay engaged without feeling overwhelmed or under-informed.
              </Text>
            </View>

            <Pressable
              style={styles.insightInfoClose}
              onPress={() => setShowInsightInfo(false)}
            >
              <Text style={styles.insightInfoCloseText}>GOT IT</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showNewEnvModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewEnvModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: topPad + 12 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowNewEnvModal(false)}>
              <Feather name="x" size={24} color={Colors.textMuted} />
            </Pressable>
            <Text style={styles.modalTitle}>NEW ENVIRONMENT</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 100, gap: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>GYM NAME</Text>
              <TextInput
                style={styles.modalTextInput}
                value={newEnvName}
                onChangeText={setNewEnvName}
                placeholder="e.g. Hotel Gym, CrossFit Box"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>GYM TYPE</Text>
              <View style={styles.modalTypeGrid}>
                {GYM_TYPES.map((t) => (
                  <Pressable
                    key={t.label}
                    style={[styles.modalTypeCard, newEnvType === t.label && styles.modalTypeCardActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setNewEnvType(t.label);
                    }}
                  >
                    <Feather
                      name={t.icon}
                      size={18}
                      color={newEnvType === t.label ? Colors.orange : Colors.textMuted}
                    />
                    <Text style={[styles.modalTypeText, newEnvType === t.label && styles.modalTypeTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>EQUIPMENT</Text>
              <EquipmentChecklist selected={newEnvEquipment} onToggle={toggleEquipment} />
            </View>
          </ScrollView>
          <View style={[styles.modalFooter, { paddingBottom: botPad + 12 }]}>
            <Pressable
              style={[styles.modalSaveBtn, (!newEnvName.trim() || !newEnvType || isCreating) && styles.modalSaveBtnDisabled]}
              onPress={handleCreateEnv}
              disabled={!newEnvName.trim() || !newEnvType || isCreating}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.modalSaveBtnText}>{isCreating ? "SAVING..." : "CREATE ENVIRONMENT"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editEnvId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditEnvId(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: topPad + 12 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setEditEnvId(null)}>
              <Feather name="x" size={24} color={Colors.textMuted} />
            </Pressable>
            <Text style={styles.modalTitle}>EDIT ENVIRONMENT</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 100, gap: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>GYM NAME</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editEnvName}
                onChangeText={setEditEnvName}
                placeholder="e.g. Hotel Gym, CrossFit Box"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>GYM TYPE</Text>
              <View style={styles.modalTypeGrid}>
                {GYM_TYPES.map((t) => (
                  <Pressable
                    key={t.label}
                    style={[styles.modalTypeCard, editEnvType === t.label && styles.modalTypeCardActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEditEnvType(t.label);
                    }}
                  >
                    <Feather
                      name={t.icon}
                      size={18}
                      color={editEnvType === t.label ? Colors.orange : Colors.textMuted}
                    />
                    <Text style={[styles.modalTypeText, editEnvType === t.label && styles.modalTypeTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>EQUIPMENT</Text>
              <EquipmentChecklist selected={editEnvEquipment} onToggle={toggleEditEquipment} />
            </View>
          </ScrollView>
          <View style={[styles.modalFooter, { paddingBottom: botPad + 12 }]}>
            <Pressable
              style={[styles.modalSaveBtn, (!editEnvName.trim() || !editEnvType || isUpdating) && styles.modalSaveBtnDisabled]}
              onPress={handleUpdateEnv}
              disabled={!editEnvName.trim() || !editEnvType || isUpdating}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.modalSaveBtnText}>{isUpdating ? "SAVING..." : "SAVE CHANGES"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingContainer: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { marginBottom: 4 },
  sectionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 2 },
  avatarCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 20,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(252,82,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(252,82,0,0.3)",
  },
  avatarInitial: { fontSize: 28, fontFamily: "Inter_900Black", color: Colors.orange },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 2,
    borderColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  nameArea: { flex: 1, gap: 4 },
  displayName: { fontSize: 18, fontFamily: "Inter_900Black", color: Colors.text, fontStyle: "italic" },
  email: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  memberBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(252,82,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.3)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  memberText: { fontSize: 8, fontFamily: "Inter_900Black", color: Colors.orange, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_900Black", fontStyle: "italic" },
  statUnit: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  statLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  auditHeader: { borderLeftWidth: 2, borderLeftColor: Colors.orange, paddingLeft: 8 },
  auditHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  auditTitle: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textSubtle, letterSpacing: 2 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  editBtnText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
  onboardingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  onboardingItem: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  onboardingLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
  onboardingValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  injuryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(252,82,0,0.08)",
    borderRadius: 10,
    padding: 10,
  },
  injuryText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.orange, flex: 1 },
  editForm: { gap: 14 },
  editRow: { flexDirection: "row", gap: 10 },
  editField: { gap: 6 },
  editFieldHalf: { flex: 1, gap: 6 },
  editFieldLabel: { fontSize: 9, fontFamily: "Inter_900Black", color: Colors.textSubtle, letterSpacing: 2 },
  editInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  editChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  editChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editChipActive: { borderColor: Colors.orange, backgroundColor: "rgba(252,82,0,0.1)" },
  editChipText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  editChipTextActive: { color: Colors.orange, fontFamily: "Inter_700Bold" },
  freqRow: { flexDirection: "row", gap: 8 },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  freqBtnActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  freqBtnText: { fontSize: 12, fontFamily: "Inter_900Black", color: Colors.textMuted },
  freqBtnTextActive: { color: "#fff" },
  envHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSubtle, lineHeight: 16 },
  envList: { gap: 8 },
  envRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
  },
  envRowActive: { borderColor: Colors.orange, backgroundColor: "rgba(252,82,0,0.06)" },
  envInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  envIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  envTextArea: { flex: 1 },
  envName: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  envNameActive: { color: Colors.orange },
  envType: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSubtle },
  activeBadge: {
    backgroundColor: "rgba(252,82,0,0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 8, fontFamily: "Inter_900Black", color: Colors.orange, letterSpacing: 1 },
  envBtnsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  envEditBtn: { padding: 8 },
  envDeleteBtn: { padding: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSubtle, textAlign: "center", paddingVertical: 8 },
  addEnvBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(252,82,0,0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    borderStyle: "dashed",
  },
  addEnvBtnText: { fontSize: 11, fontFamily: "Inter_900Black", color: Colors.orange, letterSpacing: 1 },
  infoIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  prefSection: { gap: 10 },
  prefLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSubtle, letterSpacing: 1 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  toggleBtnText: { fontSize: 12, fontFamily: "Inter_900Black", color: Colors.textMuted },
  toggleBtnTextActive: { color: "#fff" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
    backgroundColor: "rgba(248,113,113,0.06)",
    borderRadius: 16,
    paddingVertical: 16,
  },
  logoutText: { fontSize: 12, fontFamily: "Inter_900Black", color: "#F87171", letterSpacing: 1 },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  deleteAccountText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#78716C", letterSpacing: 1 },
  insightOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  insightInfoCard: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    width: "100%",
    maxWidth: 400,
  },
  insightInfoHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  insightInfoTitle: { fontSize: 12, fontFamily: "Inter_900Black", color: Colors.text, letterSpacing: 1, fontStyle: "italic" },
  insightInfoSection: { gap: 4 },
  insightInfoLabel: { fontSize: 10, fontFamily: "Inter_900Black", color: Colors.orange, letterSpacing: 1 },
  insightInfoWhyLabel: { fontSize: 10, fontFamily: "Inter_900Black", color: Colors.recovery, letterSpacing: 1 },
  insightInfoDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 20 },
  insightInfoDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)" },
  insightInfoClose: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  insightInfoCloseText: { fontSize: 12, fontFamily: "Inter_900Black", color: "#fff", letterSpacing: 1 },
  modalContainer: { flex: 1, backgroundColor: Colors.bgPrimary },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 14,
    fontFamily: "Inter_900Black",
    color: Colors.text,
    letterSpacing: 1,
    fontStyle: "italic",
  },
  modalInputGroup: { gap: 8 },
  modalInputLabel: {
    fontSize: 9,
    fontFamily: "Inter_900Black",
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  modalTextInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  modalTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalTypeCard: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 6,
  },
  modalTypeCardActive: { borderColor: Colors.orange, backgroundColor: "rgba(252,82,0,0.1)" },
  modalTypeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted },
  modalTypeTextActive: { color: Colors.orange },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  modalSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 16,
  },
  modalSaveBtnDisabled: { opacity: 0.4 },
  modalSaveBtnText: {
    fontSize: 13,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
});
