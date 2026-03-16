import { boolean, date, integer, jsonb, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
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
  onboardingCompleted: boolean("onboarding_completed").default(false),
  insightDetailLevel: varchar("insight_detail_level").default("simple"),
  syncPreferences: jsonb("sync_preferences").$type<{ appleHealth: boolean; strava: boolean; manualScreenshot: boolean }>().default({ appleHealth: false, strava: false, manualScreenshot: false }),
  activeEnvironmentId: integer("active_environment_id"),
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
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("daily_checkin_user_date").on(table.userId, table.date)]);

export type DailyCheckIn = typeof dailyCheckInsTable.$inferSelect;
export type InsertDailyCheckIn = typeof dailyCheckInsTable.$inferInsert;

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
