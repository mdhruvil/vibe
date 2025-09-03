import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const chat = sqliteTable("chat", {
  id: text("id")
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  created_by: text("created_by")
    .references(() => user.id, {
      onDelete: "cascade",
    })
    .notNull(),
  title: text("title").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});
