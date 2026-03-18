import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Saved phrases (studio quick templates)
export const savedPhrases = pgTable("saved_phrases", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  originalText: text("original_text").notNull(),
  category: text("category").notNull().default("general"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertSavedPhraseSchema = createInsertSchema(savedPhrases).omit({ id: true });
export type InsertSavedPhrase = z.infer<typeof insertSavedPhraseSchema>;
export type SavedPhrase = typeof savedPhrases.$inferSelect;

// Translation history
export const translationHistory = pgTable("translation_history", {
  id: serial("id").primaryKey(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text").notNull(),
  targetLanguage: text("target_language").notNull(),
  tone: text("tone").notNull().default("formal"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTranslationHistorySchema = createInsertSchema(translationHistory).omit({ id: true, createdAt: true });
export type InsertTranslationHistory = z.infer<typeof insertTranslationHistorySchema>;
export type TranslationHistory = typeof translationHistory.$inferSelect;
