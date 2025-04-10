import { 
  Board, InsertBoard, 
  Column, InsertColumn, 
  Card, InsertCard, 
  User, InsertUser,
  Chat, InsertChat,
  Attachment, InsertAttachment,
  boards,
  columns,
  cards,
  users,
  chats,
  attachments
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Interface for storage operations
export interface IStorage {
  // Board operations
  getBoards(): Promise<(Board & { columns: (Column & { cards: (Card & { chats?: Chat[], attachments?: Attachment[] })[] })[] })[]>;
  getBoardById(id: number): Promise<(Board & { columns: (Column & { cards: (Card & { chats?: Chat[], attachments?: Attachment[] })[] })[] }) | undefined>;
  createBoard(board: InsertBoard): Promise<Board>;
  updateBoard(id: number, data: Partial<Board>): Promise<Board | undefined>;
  deleteBoard(id: number): Promise<void>;
  
  // Column operations
  getColumnById(id: number): Promise<Column | undefined>;
  createColumn(column: InsertColumn): Promise<Column>;
  updateColumn(id: number, data: Partial<Column>): Promise<Column | undefined>;
  deleteColumn(id: number): Promise<void>;
  reorderColumns(boardId: number, updates: { id: number, order: number }[]): Promise<void>;
  
  // Card operations
  getCardById(id: number): Promise<(Card & { chats?: Chat[], attachments?: Attachment[] }) | undefined>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: number, data: Partial<Card>): Promise<Card | undefined>;
  deleteCard(id: number): Promise<void>;
  moveCard(cardId: number, destinationColumnId: number, position?: number): Promise<Card | undefined>;
  reorderCards(columnId: number, updates: { id: number, order: number }[]): Promise<void>;
  
  // Chat operations
  getChatsByCardId(cardId: number): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  
  // Attachment operations
  getAttachmentsByCardId(cardId: number, attachmentId?: number): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<void>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // Board Methods
  async getBoards(): Promise<(Board & { columns: (Column & { cards: (Card & { chats?: Chat[], attachments?: Attachment[] })[] })[] })[]> {
    const boardList = await db.select().from(boards).orderBy(asc(boards.id));

    return Promise.all(
      boardList.map(async (board) => {
        const boardColumns = await db
          .select()
          .from(columns)
          .where(eq(columns.boardId, board.id))
          .orderBy(asc(columns.order));

        return {
          ...board,
          columns: await Promise.all(
            boardColumns.map(async (column) => {
              const columnCards = await db
                .select()
                .from(cards)
                .where(eq(cards.columnId, column.id))
                .orderBy(asc(cards.order));

              return {
                ...column,
                cards: await Promise.all(
                  columnCards.map(async (card) => {
                    const cardChats = await this.getChatsByCardId(card.id);
                    const cardAttachments = await this.getAttachmentsByCardId(card.id);
                    
                    return {
                      ...card,
                      chats: cardChats,
                      attachments: cardAttachments
                    };
                  })
                )
              };
            })
          )
        };
      })
    );
  }

  async getBoardById(id: number): Promise<(Board & { columns: (Column & { cards: (Card & { chats?: Chat[], attachments?: Attachment[] })[] })[] }) | undefined> {
    const [board] = await db.select().from(boards).where(eq(boards.id, id));
    if (!board) return undefined;

    const boardColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, id))
      .orderBy(asc(columns.order));

    return {
      ...board,
      columns: await Promise.all(
        boardColumns.map(async (column) => {
          const columnCards = await db
            .select()
            .from(cards)
            .where(eq(cards.columnId, column.id))
            .orderBy(asc(cards.order));

          return {
            ...column,
            cards: await Promise.all(
              columnCards.map(async (card) => {
                const cardChats = await this.getChatsByCardId(card.id);
                const cardAttachments = await this.getAttachmentsByCardId(card.id);
                
                return {
                  ...card,
                  chats: cardChats,
                  attachments: cardAttachments
                };
              })
            )
          };
        })
      )
    };
  }

  async createBoard(board: InsertBoard): Promise<Board> {
    // If a userId is provided but doesn't exist in the database, set it to null
    let userId = board.userId;
    if (userId) {
      const user = await this.getUser(userId);
      if (!user) {
        userId = null;
      }
    }
    
    const [newBoard] = await db
      .insert(boards)
      .values({
        name: board.name,
        userId: userId
      })
      .returning();
    
    return newBoard;
  }

  async updateBoard(id: number, data: Partial<Board>): Promise<Board | undefined> {
    const [updatedBoard] = await db
      .update(boards)
      .set(data)
      .where(eq(boards.id, id))
      .returning();
    
    return updatedBoard;
  }

  async deleteBoard(id: number): Promise<void> {
    // Get all columns associated with this board
    const boardColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, id));

    // Delete all cards in each column
    for (const column of boardColumns) {
      await this.deleteColumn(column.id);
    }

    // Delete the board
    await db
      .delete(boards)
      .where(eq(boards.id, id));
  }

  // Column Methods
  async getColumnById(id: number): Promise<Column | undefined> {
    const [column] = await db
      .select()
      .from(columns)
      .where(eq(columns.id, id));
    
    return column;
  }

  async createColumn(column: InsertColumn): Promise<Column> {
    // Find the highest order in this board
    const [maxOrderResult] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${columns.order}), -1)` })
      .from(columns)
      .where(eq(columns.boardId, column.boardId));
    
    const order = (maxOrderResult?.maxOrder ?? -1) + 1;
    
    const [newColumn] = await db
      .insert(columns)
      .values({
        name: column.name,
        boardId: column.boardId,
        order,
        gptAssigned: column.gptAssigned || false,
        gptName: column.gptName || null,
        gptInstructions: column.gptInstructions || null,
        autoTrigger: column.autoTrigger !== false,
        apiKey: column.apiKey || null
      })
      .returning();
    
    return newColumn;
  }

  async updateColumn(id: number, data: Partial<Column>): Promise<Column | undefined> {
    const [updatedColumn] = await db
      .update(columns)
      .set(data)
      .where(eq(columns.id, id))
      .returning();
    
    return updatedColumn;
  }

  async deleteColumn(id: number): Promise<void> {
    // Get all cards in this column
    const columnCards = await db
      .select()
      .from(cards)
      .where(eq(cards.columnId, id));

    // Delete all cards
    for (const card of columnCards) {
      await this.deleteCard(card.id);
    }

    // Delete the column
    await db
      .delete(columns)
      .where(eq(columns.id, id));
  }

  async reorderColumns(boardId: number, updates: { id: number, order: number }[]): Promise<void> {
    for (const update of updates) {
      await db
        .update(columns)
        .set({ order: update.order })
        .where(and(
          eq(columns.id, update.id),
          eq(columns.boardId, boardId)
        ));
    }
  }

  // Card Methods
  async getCardById(id: number): Promise<(Card & { chats?: Chat[], attachments?: Attachment[] }) | undefined> {
    const [card] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, id));
    
    if (!card) return undefined;

    const cardChats = await this.getChatsByCardId(id);
    const cardAttachments = await this.getAttachmentsByCardId(id);

    return {
      ...card,
      chats: cardChats,
      attachments: cardAttachments
    };
  }

  async createCard(card: InsertCard): Promise<Card> {
    // Find the highest order in this column
    const [maxOrderResult] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${cards.order}), -1)` })
      .from(cards)
      .where(eq(cards.columnId, card.columnId));
    
    const order = (maxOrderResult?.maxOrder ?? -1) + 1;
    
    const [newCard] = await db
      .insert(cards)
      .values({
        title: card.title,
        description: card.description || "",
        columnId: card.columnId,
        order,
        gptOutput: null,
        gptTags: null,
        processing: false
      })
      .returning();
    
    return newCard;
  }

  async updateCard(id: number, data: Partial<Card>): Promise<Card | undefined> {
    const [updatedCard] = await db
      .update(cards)
      .set(data)
      .where(eq(cards.id, id))
      .returning();
    
    return updatedCard;
  }

  async deleteCard(id: number): Promise<void> {
    // Delete all chats associated with this card
    await db
      .delete(chats)
      .where(eq(chats.cardId, id));
    
    // Delete all attachments associated with this card
    await db
      .delete(attachments)
      .where(eq(attachments.cardId, id));
    
    // Delete the card
    await db
      .delete(cards)
      .where(eq(cards.id, id));
  }

  async moveCard(cardId: number, destinationColumnId: number, position?: number): Promise<Card | undefined> {
    // Get the card
    const [card] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, cardId));
    
    if (!card) return undefined;
    
    const sourceColumnId = card.columnId;
    
    // If staying in the same column and no position specified, do nothing
    if (sourceColumnId === destinationColumnId && position === undefined) {
      return card;
    }
    
    // Update the card's column
    let updatedCard;
    
    if (position !== undefined) {
      // Get cards in destination column
      const destinationCards = await db
        .select()
        .from(cards)
        .where(and(
          eq(cards.columnId, destinationColumnId),
          sql`${cards.id} != ${cardId}`
        ))
        .orderBy(asc(cards.order));
      
      // Calculate new orders
      let newOrders: { id: number, order: number }[] = [];
      
      // Create a copy to insert the moved card
      const reorderedCards = [...destinationCards];
      reorderedCards.splice(position, 0, { ...card, columnId: destinationColumnId });
      
      // Generate new orders
      newOrders = reorderedCards.map((c, index) => ({
        id: c.id,
        order: index
      }));
      
      // First update the card's column
      [updatedCard] = await db
        .update(cards)
        .set({ columnId: destinationColumnId })
        .where(eq(cards.id, cardId))
        .returning();
      
      // Then update all cards' orders
      for (const orderUpdate of newOrders) {
        await db
          .update(cards)
          .set({ order: orderUpdate.order })
          .where(eq(cards.id, orderUpdate.id));
      }
    } else {
      // Find the highest order in destination column
      const [maxOrderResult] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${cards.order}), -1)` })
        .from(cards)
        .where(and(
          eq(cards.columnId, destinationColumnId),
          sql`${cards.id} != ${cardId}`
        ));
      
      const newOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
      
      // Update both column and order
      [updatedCard] = await db
        .update(cards)
        .set({ 
          columnId: destinationColumnId,
          order: newOrder
        })
        .where(eq(cards.id, cardId))
        .returning();
    }
    
    return updatedCard;
  }

  async reorderCards(columnId: number, updates: { id: number, order: number }[]): Promise<void> {
    for (const update of updates) {
      await db
        .update(cards)
        .set({ order: update.order })
        .where(and(
          eq(cards.id, update.id),
          eq(cards.columnId, columnId)
        ));
    }
  }

  // Chat Methods
  async getChatsByCardId(cardId: number): Promise<Chat[]> {
    return db
      .select()
      .from(chats)
      .where(eq(chats.cardId, cardId))
      .orderBy(asc(chats.timestamp));
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    // Include gptName and gptColor when inserting
    const [newChat] = await db
      .insert(chats)
      .values({
        cardId: chat.cardId,
        role: chat.role,
        content: chat.content,
        gptName: chat.gptName || null,  // Ensure we include GPT metadata if available
        gptColor: chat.gptColor || null
      })
      .returning();
    
    return newChat;
  }

  // Attachment Methods
  async getAttachmentsByCardId(cardId: number, attachmentId?: number): Promise<Attachment[]> {
    // If attachmentId is provided, fetch that specific attachment
    if (attachmentId !== undefined) {
      return db
        .select()
        .from(attachments)
        .where(eq(attachments.id, attachmentId));
    }
    
    // Otherwise fetch all attachments for the card
    return db
      .select()
      .from(attachments)
      .where(eq(attachments.cardId, cardId))
      .orderBy(asc(attachments.createdAt));
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db
      .insert(attachments)
      .values({
        cardId: attachment.cardId,
        filename: attachment.filename,
        fileType: attachment.fileType,
        content: attachment.content
      })
      .returning();
    
    return newAttachment;
  }

  async deleteAttachment(id: number): Promise<void> {
    await db
      .delete(attachments)
      .where(eq(attachments.id, id));
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    return user;
  }
}

// Create a single instance of the storage
export const storage = new DatabaseStorage();
