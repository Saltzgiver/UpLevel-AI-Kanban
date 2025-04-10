import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Boards table
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBoardSchema = createInsertSchema(boards).pick({
  name: true,
  userId: true,
});

// Columns table
export const columns = pgTable("columns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  boardId: integer("board_id").references(() => boards.id).notNull(),
  order: integer("order").notNull(),
  gptAssigned: boolean("gpt_assigned").default(false),
  gptName: text("gpt_name"),
  gptInstructions: text("gpt_instructions"),
  gptColor: text("gpt_color"),
  autoTrigger: boolean("auto_trigger").default(true),
  apiKey: text("api_key"),
});

export const insertColumnSchema = createInsertSchema(columns).pick({
  name: true,
  boardId: true,
  order: true,
  gptAssigned: true,
  gptName: true,
  gptInstructions: true,
  gptColor: true,
  autoTrigger: true,
  apiKey: true,
});

// Cards table
export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  columnId: integer("column_id").references(() => columns.id).notNull(),
  order: integer("order").notNull(),
  gptOutput: text("gpt_output"),
  gptTags: text("gpt_tags"),
  processing: boolean("processing").default(false),
  includeChatHistory: boolean("include_chat_history").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardSchema = createInsertSchema(cards).pick({
  title: true,
  description: true,
  columnId: true,
  order: true,
});

// Chats table for GPT conversations
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => cards.id).notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  gptName: text("gpt_name"), // Store the GPT name that created this message
  gptColor: text("gpt_color"), // Store the GPT color that created this message
});

// Base schema with validation
export const insertChatSchema = createInsertSchema(chats)
  .pick({
    cardId: true,
    role: true,
    content: true,
    gptName: true,
    gptColor: true,
  })
  .extend({
    // Make timestamp optional in the input schema and handle it server-side
    timestamp: z.date().optional(),
  });

// Attachments table for files
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => cards.id).notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  content: text("content").notNull(), // Base64 encoded content
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttachmentSchema = createInsertSchema(attachments).pick({
  cardId: true,
  filename: true,
  fileType: true,
  content: true,
});

// Type definitions based on the tables
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Board = typeof boards.$inferSelect;
export type InsertBoard = z.infer<typeof insertBoardSchema>;

export type Column = typeof columns.$inferSelect;
export type InsertColumn = z.infer<typeof insertColumnSchema>;

export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;

export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
