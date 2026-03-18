import { Feather, Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import { AppTourOverlay, markTourSeen } from "@/components/AppTourOverlay";
import {
  loadNotifPrefs,
  saveNotifPrefs,
  applyNotifPrefs,
  sendTestNotification,
  type NotifPrefs,
  DEFAULT_NOTIF_PREFS,
} from "@/lib/notifications";

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
import { useProfile, useUpdateProfile, useDeleteAccount } from "@/hooks/useProfile";
import { syncWithAppleHealth, isHealthKitAvailable } from "@/services/healthKit";
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
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();
  const { data: environments } = useEnvironments();
  const { mutate: activateEnv } = useActivateEnvironment();
  const { mutate: createEnv, isPending: isCreating } = useCreateEnvironment();
  const { mutate: updateEnv, isPending: isUpdating } = useUpdateEnvironment();
  const { mutate: deleteEnv } = useDeleteEnvironment();

  const [editingGeneral, setEditingGeneral] = useState(false);
  const [editAge, setEditAge] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editHeightFt, setEditHeightFt] = useState("");
  const [editHeightIn, setEditHeightIn] = useState("");
  const [editHeightCm, setEditHeightCm] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editUnitSystem, setEditUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [pendingFrequency, setPendingFrequency] = useState<number | null>(null);
  const [pendingDuration, setPendingDuration] = useState<number | null>(null);

  const [showNewEnvModal, setShowNewEnvModal] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvType, setNewEnvType] = useState("");
  const [newEnvEquipment, setNewEnvEquipment] = useState<Record<string, string[]>>({});

  const [editEnvId, setEditEnvId] = useState<number | null>(null);
  const [editEnvName, setEditEnvName] = useState("");
  const [editEnvType, setEditEnvType] = useState("");
  const [editEnvEquipment, setEditEnvEquipment] = useState<Record<string, string[]>>({});

  const [showInsightInfo, setShowInsightInfo] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ ...DEFAULT_NOTIF_PREFS });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifDirty, setNotifDirty] = useState(false);

  useEffect(() => {
    loadNotifPrefs().then(setNotifPrefs);
  }, []);

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
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            deleteAccount(undefined, {
              onSuccess: () => router.replace("/welcome"),
              onError: () =>
                Alert.alert("Error", "Could not delete your account. Please try again."),
            });
          },
        },
      ]
    );
  };

  const handleHealthSync = async () => {
    if (!isHealthKitAvailable()) {
      Alert.alert("Not Available", "Apple Health is only available on iOS devices.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHealthSyncing(true);
    try {
      const result = await syncWithAppleHealth();
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Sync Complete",
          `All-time data synced:\n• ${result.steps?.toLocaleString() ?? 0} total steps\n• ${result.activeCalories?.toLocaleString() ?? 0} total active calories\n• ${result.workoutCount ?? 0} total workouts`
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Sync Failed",
          "Could not connect to Apple Health. Please check your permissions in Settings > Privacy & Security > Health."
        );
      }
    } finally {
      setHealthSyncing(false);
    }
  };

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.email?.split("@")[0] ?? "Athlete";

  const activeUnit = (profile?.unitSystem ?? "imperial") as "imperial" | "metric";
  const [displayUnit, setDisplayUnit] = useState<"imperial" | "metric">("imperial");

  useEffect(() => {
    setDisplayUnit(activeUnit);
  }, [activeUnit]);

  const formatHeightDisplay = (h: number | null | undefined, unit: "imperial" | "metric") => {
    if (!h) return "—";
    if (unit === "imperial") {
      const ft = Math.floor(h / 12);
      const inches = h % 12;
      return `${ft}′ ${inches}″`;
    }
    return `${h} cm`;
  };

  const toggleDisplayUnit = (newSystem: "imperial" | "metric") => {
    if (displayUnit === newSystem) return;
    Haptics.selectionAsync();
    setDisplayUnit(newSystem);
  };

  const switchEditUnit = (newSystem: "imperial" | "metric") => {
    if (editUnitSystem === newSystem) return;
    Haptics.selectionAsync();
    const w = editWeight ? parseInt(editWeight) : null;
    if (newSystem === "metric") {
      if (w != null && !isNaN(w)) setEditWeight(Math.round(w / 2.2046).toString());
      const ft = parseInt(editHeightFt) || 0;
      const ins = parseInt(editHeightIn) || 0;
      const totalIn = ft * 12 + ins;
      setEditHeightCm(totalIn > 0 ? Math.round(totalIn * 2.54).toString() : "");
      setEditHeightFt("");
      setEditHeightIn("");
    } else {
      if (w != null && !isNaN(w)) setEditWeight(Math.round(w * 2.2046).toString());
      const cm = parseInt(editHeightCm) || 0;
      if (cm > 0) {
        const totalIn = cm / 2.54;
        setEditHeightFt(Math.floor(totalIn / 12).toString());
        setEditHeightIn(Math.round(totalIn % 12).toString());
      } else {
        setEditHeightFt("");
        setEditHeightIn("");
      }
      setEditHeightCm("");
    }
    setEditUnitSystem(newSystem);
  };

  const convertedWeight = (() => {
    const w = profile?.weight;
    if (w == null) return null;
    if (displayUnit === activeUnit) return w;
    return displayUnit === "metric" ? Math.round(w / 2.2046) : Math.round(w * 2.2046);
  })();

  const convertedHeight = (() => {
    const h = profile?.height;
    if (h == null) return null;
    if (displayUnit === activeUnit) return h;
    return displayUnit === "metric" ? Math.round(h * 2.54) : Math.round(h / 2.54);
  })();

  const startEditingGeneral = () => {
    const unit = activeUnit;
    setEditUnitSystem(unit);
    setEditAge(profile?.age?.toString() ?? "");
    setEditWeight(profile?.weight?.toString() ?? "");
    if (unit === "imperial") {
      const h = profile?.height ?? 0;
      setEditHeightFt(h ? Math.floor(h / 12).toString() : "");
      setEditHeightIn(h ? (h % 12).toString() : "");
      setEditHeightCm("");
    } else {
      setEditHeightCm(profile?.height?.toString() ?? "");
      setEditHeightFt("");
      setEditHeightIn("");
    }
    setEditGender(profile?.gender ?? "");
    setEditLevel(profile?.experienceLevel ?? "");
    setEditGoal(profile?.primaryGoal ?? "");
    setEditingGeneral(true);
  };

  const saveGeneral = () => {
    let computedHeight: number | null = null;
    if (editUnitSystem === "imperial") {
      const ft = parseInt(editHeightFt) || 0;
      const inches = parseInt(editHeightIn) || 0;
      const total = ft * 12 + inches;
      computedHeight = total > 0 ? total : null;
    } else {
      computedHeight = editHeightCm ? parseInt(editHeightCm) : null;
    }
    updateProfile(
      {
        age: editAge ? parseInt(editAge) : null,
        weight: editWeight ? parseInt(editWeight) : null,
        height: computedHeight,
        gender: editGender || null,
        experienceLevel: editLevel || null,
        primaryGoal: editGoal || null,
        unitSystem: editUnitSystem,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setEditingGeneral(false);
        },
        onError: () =>
          Alert.alert("Save Failed", "Could not save your profile. Please try again."),
      }
    );
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

  if (isError) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPad }]}>
        <Ionicons name="alert-circle-outline" size={44} color={Colors.orange} />
        <Text style={{ color: Colors.textMuted, fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 14 }}>
          Could not load your profile
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={{ marginTop: 18, backgroundColor: Colors.orange, paddingHorizontal: 28, paddingVertical: 11, borderRadius: 10 }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_900Black", fontSize: 13 }}>RETRY</Text>
        </Pressable>
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
            <View style={styles.unitToggleRowProfile}>
              {(["imperial", "metric"] as const).map((sys) => (
                <Pressable
                  key={sys}
                  style={[styles.unitToggleBtnProfile, displayUnit === sys && styles.unitToggleBtnProfileActive]}
                  onPress={() => toggleDisplayUnit(sys)}
                >
                  <Text style={[styles.unitToggleTextProfile, displayUnit === sys && styles.unitToggleTextProfileActive]}>
                    {sys === "imperial" ? "LB · FT" : "KG · CM"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.onboardingGrid}>
              {[
                { label: "Age", value: profile?.age ? `${profile.age} yrs` : "—" },
                { label: "Weight", value: convertedWeight != null ? `${convertedWeight} ${displayUnit === "imperial" ? "lbs" : "kg"}` : "—" },
                { label: "Height", value: formatHeightDisplay(convertedHeight, displayUnit) },
                { label: "Gender", value: profile?.gender ?? "—" },
                { label: "Level", value: profile?.experienceLevel ?? "—" },
                { label: "Goal", value: profile?.primaryGoal ?? "—" },
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
            <View style={styles.unitToggleRowProfile}>
              {(["imperial", "metric"] as const).map((sys) => (
                <Pressable
                  key={sys}
                  style={[styles.unitToggleBtnProfile, editUnitSystem === sys && styles.unitToggleBtnProfileActive]}
                  onPress={() => switchEditUnit(sys)}
                >
                  <Text style={[styles.unitToggleTextProfile, editUnitSystem === sys && styles.unitToggleTextProfileActive]}>
                    {sys === "imperial" ? "LB · FT" : "KG · CM"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.editRow}>
              <View style={styles.editFieldHalf}>
                <Text style={styles.editFieldLabel}>AGE</Text>
                <TextInput
                  style={styles.editInput}
                  value={editAge}
                  onChangeText={setEditAge}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={Colors.textSubtle}
                  maxLength={3}
                />
              </View>
              <View style={styles.editFieldHalf}>
                <Text style={styles.editFieldLabel}>WEIGHT ({editUnitSystem === "imperial" ? "LBS" : "KG"})</Text>
                <TextInput
                  style={styles.editInput}
                  value={editWeight}
                  onChangeText={setEditWeight}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={Colors.textSubtle}
                  maxLength={4}
                />
              </View>
            </View>
            <View style={styles.editRow}>
              {editUnitSystem === "imperial" ? (
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editFieldLabel}>HEIGHT (FT / IN)</Text>
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.editInput, { flex: 1, textAlign: "center" }]}
                      value={editHeightFt}
                      onChangeText={setEditHeightFt}
                      keyboardType="numeric"
                      placeholder="ft"
                      placeholderTextColor={Colors.textSubtle}
                      maxLength={1}
                    />
                    <TextInput
                      style={[styles.editInput, { flex: 1, textAlign: "center" }]}
                      value={editHeightIn}
                      onChangeText={(v) => {
                        const n = parseInt(v);
                        if (!v || (n >= 0 && n <= 11)) setEditHeightIn(v);
                      }}
                      keyboardType="numeric"
                      placeholder="in"
                      placeholderTextColor={Colors.textSubtle}
                      maxLength={2}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.editFieldHalf}>
                  <Text style={styles.editFieldLabel}>HEIGHT (CM)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editHeightCm}
                    onChangeText={setEditHeightCm}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={Colors.textSubtle}
                    maxLength={3}
                  />
                </View>
              )}
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
          {FREQUENCIES.map((f) => {
            const isActive = (pendingFrequency ?? profile?.workoutFrequency) === f;
            return (
              <Pressable
                key={f}
                style={({ pressed }) => [
                  styles.freqBtn,
                  isActive && styles.freqBtnActive,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPendingFrequency(f);
                  updateProfile({ workoutFrequency: f }, {
                    onSuccess: () => setPendingFrequency(null),
                    onError: () => setPendingFrequency(null),
                  });
                }}
              >
                <Text style={[styles.freqBtnText, isActive && styles.freqBtnTextActive]}>{f}x</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>WORKOUT DURATION</Text>
        </View>
        <Text style={styles.envHint}>Set your preferred session length — used by AI when building your workouts</Text>
        <View style={styles.freqRow}>
          {[30, 45, 60, 75, 90].map((mins) => {
            const isActive = (pendingDuration ?? profile?.preferredWorkoutDuration ?? 60) === mins;
            return (
              <Pressable
                key={mins}
                style={({ pressed }) => [
                  styles.freqBtn,
                  isActive && styles.freqBtnActive,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPendingDuration(mins);
                  updateProfile({ preferredWorkoutDuration: mins }, {
                    onSuccess: () => setPendingDuration(null),
                    onError: () => setPendingDuration(null),
                  });
                }}
              >
                <Text style={[styles.freqBtnText, isActive && styles.freqBtnTextActive]}>
                  {mins}m
                </Text>
              </Pressable>
            );
          })}
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
                      name={(GYM_TYPES.find(t => t.label === env.type)?.icon ?? "map-pin") as FeatherIcon}
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
                      Alert.alert(
                        "Delete Environment",
                        `Remove "${env.name}" from your gym environments? This cannot be undone.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteEnv(env.id),
                          },
                        ]
                      );
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

      {isHealthKitAvailable() && (
        <Pressable
          style={({ pressed }) => [styles.healthSyncBtn, { opacity: pressed || healthSyncing ? 0.8 : 1 }]}
          onPress={handleHealthSync}
          disabled={healthSyncing}
        >
          {healthSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="heart" size={16} color="#fff" />
          )}
          <Text style={styles.healthSyncText}>
            {healthSyncing ? "SYNCING..." : "SYNC WITH APPLE HEALTH"}
          </Text>
        </Pressable>
      )}

      <View style={styles.sectionCard}>
        <View style={styles.auditHeaderRow}>
          <View style={styles.auditHeader}>
            <Text style={styles.auditTitle}>NOTIFICATIONS</Text>
          </View>
          <View style={[styles.notifStatusBadge, { backgroundColor: (notifPrefs.checkInEnabled || notifPrefs.workoutEnabled) ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)" }]}>
            <View style={[styles.notifStatusDot, { backgroundColor: (notifPrefs.checkInEnabled || notifPrefs.workoutEnabled) ? "#4ADE80" : Colors.textSubtle }]} />
            <Text style={[styles.notifStatusText, { color: (notifPrefs.checkInEnabled || notifPrefs.workoutEnabled) ? "#4ADE80" : Colors.textSubtle }]}>
              {(notifPrefs.checkInEnabled || notifPrefs.workoutEnabled) ? "ACTIVE" : "OFF"}
            </Text>
          </View>
        </View>

        <View style={styles.notifRow}>
          <View style={styles.notifRowInfo}>
            <Feather name="sun" size={14} color={Colors.highlight} />
            <View style={styles.notifRowText}>
              <Text style={styles.notifRowTitle}>Check-in Reminder</Text>
              <Text style={styles.notifRowSub}>Daily morning prompt to log your energy & soreness</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setNotifPrefs((p) => ({ ...p, checkInEnabled: !p.checkInEnabled }));
              setNotifDirty(true);
            }}
            style={[styles.notifToggle, notifPrefs.checkInEnabled && styles.notifToggleOn]}
          >
            <View style={[styles.notifToggleThumb, notifPrefs.checkInEnabled && styles.notifToggleThumbOn]} />
          </Pressable>
        </View>

        {notifPrefs.checkInEnabled && (
          <View style={styles.notifTimeRow}>
            <Text style={styles.notifTimeLabel}>TIME</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.notifChips}>
                {[6, 7, 8, 9, 10, 11].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setNotifPrefs((p) => ({ ...p, checkInHour: h }));
                      setNotifDirty(true);
                    }}
                    style={[styles.notifChip, notifPrefs.checkInHour === h && styles.notifChipActive]}
                  >
                    <Text style={[styles.notifChipText, notifPrefs.checkInHour === h && styles.notifChipTextActive]}>
                      {h <= 12 ? `${h} AM` : `${h - 12} PM`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={[styles.notifRow, { marginTop: 8 }]}>
          <View style={styles.notifRowInfo}>
            <Feather name="zap" size={14} color={Colors.orange} />
            <View style={styles.notifRowText}>
              <Text style={styles.notifRowTitle}>Workout Reminder</Text>
              <Text style={styles.notifRowSub}>Evening nudge to log your session & protect your streak</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setNotifPrefs((p) => ({ ...p, workoutEnabled: !p.workoutEnabled }));
              setNotifDirty(true);
            }}
            style={[styles.notifToggle, notifPrefs.workoutEnabled && styles.notifToggleOn]}
          >
            <View style={[styles.notifToggleThumb, notifPrefs.workoutEnabled && styles.notifToggleThumbOn]} />
          </Pressable>
        </View>

        {notifPrefs.workoutEnabled && (
          <View style={styles.notifTimeRow}>
            <Text style={styles.notifTimeLabel}>TIME</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.notifChips}>
                {[15, 16, 17, 18, 19, 20, 21].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setNotifPrefs((p) => ({ ...p, workoutHour: h }));
                      setNotifDirty(true);
                    }}
                    style={[styles.notifChip, notifPrefs.workoutHour === h && styles.notifChipActive]}
                  >
                    <Text style={[styles.notifChipText, notifPrefs.workoutHour === h && styles.notifChipTextActive]}>
                      {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.notifActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              sendTestNotification(notifPrefs.checkInEnabled ? "checkin" : "workout");
            }}
            style={({ pressed }) => [styles.notifTestBtn, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="bell" size={12} color={Colors.textSubtle} />
            <Text style={styles.notifTestText}>Send test</Text>
          </Pressable>
          {notifDirty && (
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setNotifSaving(true);
                await saveNotifPrefs(notifPrefs);
                await applyNotifPrefs(notifPrefs);
                setNotifDirty(false);
                setNotifSaving(false);
              }}
              style={({ pressed }) => [styles.notifSaveBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              {notifSaving ? (
                <ActivityIndicator size="small" color={Colors.bgPrimary} />
              ) : (
                <>
                  <Feather name="check" size={13} color={Colors.bgPrimary} />
                  <Text style={styles.notifSaveText}>Save & Apply</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.replayTourBtn, { opacity: pressed ? 0.8 : 1 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          markTourSeen().then(() => {});
          setShowTour(true);
        }}
      >
        <Feather name="compass" size={15} color={Colors.textSubtle} />
        <Text style={styles.replayTourText}>REPLAY APP TOUR</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={16} color="#F87171" />
        <Text style={styles.logoutText}>SIGN OUT</Text>
      </Pressable>

      <AppTourOverlay visible={showTour} onDone={() => setShowTour(false)} />

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
  unitToggleRowProfile: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  unitToggleBtnProfile: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
  },
  unitToggleBtnProfileActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(252,82,0,0.1)",
  },
  unitToggleTextProfile: {
    fontSize: 10,
    fontFamily: "Inter_900Black",
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  unitToggleTextProfileActive: { color: Colors.orange },
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
  healthSyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#E1306C",
    borderRadius: 16,
    paddingVertical: 16,
  },
  healthSyncText: {
    fontSize: 12,
    fontFamily: "Inter_900Black",
    color: "#fff",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  notifStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  notifStatusDot: { width: 6, height: 6, borderRadius: 3 },
  notifStatusText: { fontSize: 8, fontFamily: "Inter_900Black", letterSpacing: 1 },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  notifRowInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  notifRowText: { flex: 1, gap: 2 },
  notifRowTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  notifRowSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 16 },
  notifToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifToggleOn: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  notifToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.textSubtle,
    alignSelf: "flex-start",
  },
  notifToggleThumbOn: {
    backgroundColor: "#fff",
    alignSelf: "flex-end",
  },
  notifTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 24,
  },
  notifTimeLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
    width: 30,
  },
  notifChips: { flexDirection: "row", gap: 6 },
  notifChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifChipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  notifChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textMuted },
  notifChipTextActive: { color: "#fff" },
  notifActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  notifTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifTestText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSubtle },
  notifSaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.orange,
  },
  notifSaveText: { fontSize: 12, fontFamily: "Inter_900Black", color: Colors.bgPrimary, letterSpacing: 0.5 },
  replayTourBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  replayTourText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
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
