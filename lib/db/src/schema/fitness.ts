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
  equipment: jsonb("equipment").$type<string[]>(),
  skillLevel: varchar("skill_level"),
  injuries: jsonb("injuries").$type<string[]>(),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
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
  soreMuscleGroups: jsonb("sore_muscle_groups").$type<string[]>().default([]),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExternalWorkout = typeof externalWorkoutsTable.$inferSelect;
export type InsertExternalWorkout = typeof externalWorkoutsTable.$inferInsert;
