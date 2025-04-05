import { Board, Column, Card, Attachment, Chat } from "@shared/schema";

// Re-export the types from shared/schema.ts
export type { Board, Column, Card, Attachment, Chat };

// Extended types with relationships
export interface BoardWithRelations extends Board {
  columns: ColumnWithRelations[];
}

export interface ColumnWithRelations extends Column {
  cards: CardWithRelations[];
}

export interface CardWithRelations extends Card {
  chats?: Chat[];
  attachments?: Attachment[];
}

// DND related types
export interface DragItem {
  id: string;
  type: string;
  index: number;
}
