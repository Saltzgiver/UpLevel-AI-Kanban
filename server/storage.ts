import { 
  Board, InsertBoard, 
  Column, InsertColumn, 
  Card, InsertCard, 
  User, InsertUser,
  Chat, InsertChat,
  Attachment, InsertAttachment
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need
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
  getAttachmentsByCardId(cardId: number): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<void>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private boards: Map<number, Board>;
  private columns: Map<number, Column>;
  private cards: Map<number, Card>;
  private users: Map<number, User>;
  private chats: Map<number, Chat>;
  private attachments: Map<number, Attachment>;
  
  private boardIdCounter: number;
  private columnIdCounter: number;
  private cardIdCounter: number;
  private userIdCounter: number;
  private chatIdCounter: number;
  private attachmentIdCounter: number;

  constructor() {
    this.boards = new Map();
    this.columns = new Map();
    this.cards = new Map();
    this.users = new Map();
    this.chats = new Map();
    this.attachments = new Map();
    
    this.boardIdCounter = 1;
    this.columnIdCounter = 1;
    this.cardIdCounter = 1;
    this.userIdCounter = 1;
    this.chatIdCounter = 1;
    this.attachmentIdCounter = 1;
  }

  // Board Methods
  async getBoards(): Promise<(Board & { columns: (Column & { cards: (Card & { chats?: Chat[], attachments?: Attachment[] })[] })[] })[]> {
    const boards = Array.from(this.boards.values());
    return Promise.all(
      boards.map(async (board) => {
        const columns = await this.getBoardColumns(board.id);
        return {
          ...board,
          columns: await Promise.all(
            columns.map(async (column) => {
              const cards = await this.getColumnCards(column.id);
              return {
                ...column,
                cards: await Promise.all(
                  cards.map(async (card) => {
                    const chats = await this.getChatsByCardId(card.id);
                    const attachments = await this.getAttachmentsByCardId(card.id);
                    return {
                      ...card,
                      chats,
                      attachments
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
    const board = this.boards.get(id);
    if (!board) return undefined;

    const columns = await this.getBoardColumns(id);
    return {
      ...board,
      columns: await Promise.all(
        columns.map(async (column) => {
          const cards = await this.getColumnCards(column.id);
          return {
            ...column,
            cards: await Promise.all(
              cards.map(async (card) => {
                const chats = await this.getChatsByCardId(card.id);
                const attachments = await this.getAttachmentsByCardId(card.id);
                return {
                  ...card,
                  chats,
                  attachments
                };
              })
            )
          };
        })
      )
    };
  }

  async createBoard(board: InsertBoard): Promise<Board> {
    const id = this.boardIdCounter++;
    const now = new Date();
    const newBoard: Board = {
      id,
      name: board.name,
      userId: board.userId || null,
      createdAt: now
    };
    
    this.boards.set(id, newBoard);
    return newBoard;
  }

  async updateBoard(id: number, data: Partial<Board>): Promise<Board | undefined> {
    const board = this.boards.get(id);
    if (!board) return undefined;

    const updatedBoard = { ...board, ...data };
    this.boards.set(id, updatedBoard);
    return updatedBoard;
  }

  async deleteBoard(id: number): Promise<void> {
    // Delete all columns and cards associated with this board
    const columns = Array.from(this.columns.values()).filter(c => c.boardId === id);
    for (const column of columns) {
      await this.deleteColumn(column.id);
    }
    
    this.boards.delete(id);
  }

  private async getBoardColumns(boardId: number): Promise<Column[]> {
    const columns = Array.from(this.columns.values())
      .filter(column => column.boardId === boardId)
      .sort((a, b) => a.order - b.order);
    
    return columns;
  }

  // Column Methods
  async getColumnById(id: number): Promise<Column | undefined> {
    return this.columns.get(id);
  }

  async createColumn(column: InsertColumn): Promise<Column> {
    const id = this.columnIdCounter++;
    
    // Find the highest order in this board
    const boardColumns = Array.from(this.columns.values())
      .filter(c => c.boardId === column.boardId);
    
    const order = boardColumns.length > 0
      ? Math.max(...boardColumns.map(c => c.order)) + 1
      : 0;
    
    const newColumn: Column = {
      id,
      name: column.name,
      boardId: column.boardId,
      order,
      gptAssigned: column.gptAssigned || false,
      gptName: column.gptName || null,
      gptInstructions: column.gptInstructions || null,
      autoTrigger: column.autoTrigger !== false,
      apiKey: column.apiKey || null
    };
    
    this.columns.set(id, newColumn);
    return newColumn;
  }

  async updateColumn(id: number, data: Partial<Column>): Promise<Column | undefined> {
    const column = this.columns.get(id);
    if (!column) return undefined;

    const updatedColumn = { ...column, ...data };
    this.columns.set(id, updatedColumn);
    return updatedColumn;
  }

  async deleteColumn(id: number): Promise<void> {
    // Delete all cards in this column
    const cards = Array.from(this.cards.values()).filter(c => c.columnId === id);
    for (const card of cards) {
      await this.deleteCard(card.id);
    }
    
    this.columns.delete(id);
  }

  async reorderColumns(boardId: number, updates: { id: number, order: number }[]): Promise<void> {
    for (const update of updates) {
      const column = this.columns.get(update.id);
      if (column && column.boardId === boardId) {
        column.order = update.order;
        this.columns.set(update.id, column);
      }
    }
  }

  private async getColumnCards(columnId: number): Promise<Card[]> {
    const cards = Array.from(this.cards.values())
      .filter(card => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
    
    return cards;
  }

  // Card Methods
  async getCardById(id: number): Promise<(Card & { chats?: Chat[], attachments?: Attachment[] }) | undefined> {
    const card = this.cards.get(id);
    if (!card) return undefined;

    const chats = await this.getChatsByCardId(id);
    const attachments = await this.getAttachmentsByCardId(id);

    return {
      ...card,
      chats,
      attachments
    };
  }

  async createCard(card: InsertCard): Promise<Card> {
    const id = this.cardIdCounter++;
    const now = new Date();
    
    // Find the highest order in this column
    const columnCards = Array.from(this.cards.values())
      .filter(c => c.columnId === card.columnId);
    
    const order = columnCards.length > 0
      ? Math.max(...columnCards.map(c => c.order)) + 1
      : 0;
    
    const newCard: Card = {
      id,
      title: card.title,
      description: card.description || "",
      columnId: card.columnId,
      order,
      gptOutput: null,
      gptTags: null,
      processing: false,
      createdAt: now
    };
    
    this.cards.set(id, newCard);
    return newCard;
  }

  async updateCard(id: number, data: Partial<Card>): Promise<Card | undefined> {
    const card = this.cards.get(id);
    if (!card) return undefined;

    const updatedCard = { ...card, ...data };
    this.cards.set(id, updatedCard);
    return updatedCard;
  }

  async deleteCard(id: number): Promise<void> {
    // Delete all chats associated with this card
    const chats = Array.from(this.chats.values()).filter(c => c.cardId === id);
    for (const chat of chats) {
      this.chats.delete(chat.id);
    }
    
    // Delete all attachments associated with this card
    const attachments = Array.from(this.attachments.values()).filter(a => a.cardId === id);
    for (const attachment of attachments) {
      this.attachments.delete(attachment.id);
    }
    
    this.cards.delete(id);
  }

  async moveCard(cardId: number, destinationColumnId: number, position?: number): Promise<Card | undefined> {
    const card = this.cards.get(cardId);
    if (!card) return undefined;
    
    const sourceColumnId = card.columnId;
    
    // If staying in the same column and no position specified, do nothing
    if (sourceColumnId === destinationColumnId && position === undefined) {
      return card;
    }
    
    // Update the card's column
    card.columnId = destinationColumnId;
    
    // Update orders if position is specified
    if (position !== undefined) {
      // Get cards in destination column
      const destinationCards = Array.from(this.cards.values())
        .filter(c => c.columnId === destinationColumnId && c.id !== cardId)
        .sort((a, b) => a.order - b.order);
      
      // Insert card at specified position
      destinationCards.splice(position, 0, card);
      
      // Update order of all cards
      destinationCards.forEach((c, i) => {
        c.order = i;
        this.cards.set(c.id, c);
      });
    } else {
      // Add to the end of the destination column
      const maxOrder = Math.max(
        ...Array.from(this.cards.values())
          .filter(c => c.columnId === destinationColumnId && c.id !== cardId)
          .map(c => c.order),
        -1
      );
      
      card.order = maxOrder + 1;
    }
    
    this.cards.set(cardId, card);
    return card;
  }

  async reorderCards(columnId: number, updates: { id: number, order: number }[]): Promise<void> {
    for (const update of updates) {
      const card = this.cards.get(update.id);
      if (card && card.columnId === columnId) {
        card.order = update.order;
        this.cards.set(update.id, card);
      }
    }
  }

  // Chat Methods
  async getChatsByCardId(cardId: number): Promise<Chat[]> {
    return Array.from(this.chats.values())
      .filter(chat => chat.cardId === cardId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const id = this.chatIdCounter++;
    const now = new Date();
    
    const newChat: Chat = {
      id,
      cardId: chat.cardId,
      role: chat.role,
      content: chat.content,
      timestamp: now
    };
    
    this.chats.set(id, newChat);
    return newChat;
  }

  // Attachment Methods
  async getAttachmentsByCardId(cardId: number): Promise<Attachment[]> {
    return Array.from(this.attachments.values())
      .filter(attachment => attachment.cardId === cardId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const id = this.attachmentIdCounter++;
    const now = new Date();
    
    const newAttachment: Attachment = {
      id,
      cardId: attachment.cardId,
      filename: attachment.filename,
      fileType: attachment.fileType,
      content: attachment.content,
      createdAt: now
    };
    
    this.attachments.set(id, newAttachment);
    return newAttachment;
  }

  async deleteAttachment(id: number): Promise<void> {
    this.attachments.delete(id);
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
