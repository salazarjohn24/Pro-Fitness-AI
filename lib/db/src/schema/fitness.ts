import { boolean, date, integer, jsonb, pgTable, real, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./auth";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  streakDays: integer("streak_days").default(0),
  fitnessGoal: text("fitness_goal"),
  workoutFrequency: integer("workout_frequency").default(3),
  dailySyncProgress: integer("daily_sync_progress").default(0),
  checkInCompleted: boolean("check_in_completed").default(false),
  activityImported: boolean("activity_imported").default(false),
  equipment: jsonb("equipment").$type<string[]>().default([]),
  skillLevel: varchar("skill_level").default("intermediate"),
  age: integer("age"),
  weight: integer("weight"),
  height: integer("height"),
  gender: varchar("gender"),
  experienceLevel: varchar("experience_level"),
  injuries: jsonb("injuries").$type<string[]>().default([]),
  injuryNotes: text("injury_notes"),
  primaryGoal: varchar("primary_goal"),
  unitSystem: varchar("unit_system").default("imperial"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  insightDetailLevel: varchar("insight_detail_level").default("simple"),
  syncPreferences: jsonb("sync_preferences").$type<{ appleHealth: boolean; strava: boolean; manualScreenshot: boolean }>().default({ appleHealth: false, strava: false, manualScreenshot: false }),
  activeEnvironmentId: integer("active_environment_id"),
  preferredWorkoutDuration: integer("preferred_workout_duration").default(60),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const gymEnvironmentsTable = pgTable("gym_environments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(),
  equipment: jsonb("equipment").$type<Record<string, string[]>>().default({}),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;

export const dailyCheckInsTable = pgTable("daily_check_ins", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  energyLevel: integer("energy_level").notNull(),
  sleepQuality: integer("sleep_quality").notNull(),
  stressLevel: integer("stress_level").notNull(),
  sorenessScore: integer("soreness_score").notNull(),
  soreMuscleGroups: jsonb("sore_muscle_groups").$type<{ muscle: string; severity: number }[]>().default([]),
  sleepScore: integer("sleep_score"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("daily_checkin_user_date").on(table.userId, table.date)]);

export type DailyCheckIn = typeof dailyCheckInsTable.$inferSelect;
export type InsertDailyCheckIn = typeof dailyCheckInsTable.$inferInsert;

export interface WorkoutMovement {
  name: string;
  volume: string;
  muscleGroups: string[];
  fatiguePercent: number;
}

export const externalWorkoutsTable = pgTable("external_workouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  label: varchar("label").notNull(),
  duration: integer("duration").notNull(),
  workoutType: varchar("workout_type").notNull(),
  source: varchar("source").default("manual"),
  intensity: integer("intensity"),
  muscleGroups: jsonb("muscle_groups").$type<string[]>().default([]),
  stimulusPoints: integer("stimulus_points"),
  workoutDate: date("workout_date"),
  movements: jsonb("movements").$type<WorkoutMovement[]>().default([]),
  isMetcon: boolean("is_metcon").default(false),
  metconFormat: varchar("metcon_format"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExternalWorkout = typeof externalWorkoutsTable.$inferSelect;
export type InsertExternalWorkout = typeof externalWorkoutsTable.$inferInsert;

export const insertGymEnvironmentSchema = createInsertSchema(gymEnvironmentsTable).omit({ id: true });
export type InsertGymEnvironment = z.infer<typeof insertGymEnvironmentSchema>;
export type GymEnvironment = typeof gymEnvironmentsTable.$inferSelect;

export const workoutSessionsTable = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull().defaultNow(),
  workoutTitle: text("workout_title").notNull(),
  durationSeconds: integer("duration_seconds").default(0),
  exercises: jsonb("exercises").$type<{
    exerciseId: string;
    name: string;
    sets: { reps: number; weight: string; completed: boolean }[];
  }[]>().default([]),
  totalSetsCompleted: integer("total_sets_completed").default(0),
  totalVolume: real("total_volume"),
  consistencyIndex: real("consistency_index"),
  postWorkoutFeedback: jsonb("post_workout_feedback").$type<{
    perceivedDifficulty: number;
    energyAfter: number;
    enjoyment: number;
    notes: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkoutSession = typeof workoutSessionsTable.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessionsTable.$inferInsert;

export const exerciseLibraryTable = pgTable("exercise_library", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  muscleGroup: varchar("muscle_group").notNull(),
  equipment: varchar("equipment").notNull(),
  goal: varchar("goal").notNull(),
  difficulty: varchar("difficulty").notNull(),
  youtubeUrl: varchar("youtube_url"),
  instructions: jsonb("instructions").$type<string[]>().default([]),
  commonMistakes: jsonb("common_mistakes").$type<string[]>().default([]),
  primaryMuscles: jsonb("primary_muscles").$type<string[]>().default([]),
  secondaryMuscles: jsonb("secondary_muscles").$type<string[]>().default([]),
  tertiaryMuscles: jsonb("tertiary_muscles").$type<string[]>().default([]),
  alternativeIds: jsonb("alternative_ids").$type<number[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExerciseLibrary = typeof exerciseLibraryTable.$inferSelect;
export type InsertExerciseLibrary = typeof exerciseLibraryTable.$inferInsert;

export const workoutHistoryTable = pgTable("workout_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exerciseLibraryTable.id, { onDelete: "cascade" }),
  weight: integer("weight").notNull(),
  reps: integer("reps").notNull(),
  sets: integer("sets").notNull(),
  consistencyIndex: real("consistency_index"),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkoutHistory = typeof workoutHistoryTable.$inferSelect;
export type InsertWorkoutHistory = typeof workoutHistoryTable.$inferInsert;

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessionsTable).omit({ id: true });
export const insertExerciseLibrarySchema = createInsertSchema(exerciseLibraryTable).omit({ id: true });
export const insertWorkoutHistorySchema = createInsertSchema(workoutHistoryTable).omit({ id: true });
