import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { BoardComponent } from "@/components/board/board";
import { BoardList } from "@/components/board/board-list";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Board } from "@shared/schema";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { LayoutDashboard, KanbanSquare } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  
  // Query for all boards
  const { 
    data: boards,
    isLoading: isLoadingBoards,
    isError: isErrorBoards,
    error: boardsError
  } = useQuery<any[]>({
    queryKey: ['/api/boards'],
  });

  // Create a default board if none exists
  useEffect(() => {
    if (!isLoadingBoards && !isErrorBoards && (!boards || boards.length === 0)) {
      const createDefaultBoard = async () => {
        try {
          await apiRequest("POST", "/api/boards", { 
            name: "GPT-Enabled Kanban Board",
            userId: null // No user ID required
          });
          toast({
            title: "Welcome!",
            description: "Created your first board",
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to create default board",
            variant: "destructive"
          });
        }
      };
      createDefaultBoard();
    }
  }, [isLoadingBoards, isErrorBoards, boards, toast]);

  // Set the active board once we have data
  useEffect(() => {
    if (boards && boards.length > 0) {
      // If we have a stored board ID in localStorage, use that
      const storedBoardId = localStorage.getItem('activeBoardId');
      if (storedBoardId) {
        const boardId = parseInt(storedBoardId, 10);
        // Check if the board exists in our list
        const boardExists = boards.some(board => board.id === boardId);
        if (boardExists) {
          setActiveBoardId(boardId);
          return;
        }
      }
      
      // Otherwise use the first board
      setActiveBoardId(boards[0].id);
    }
  }, [boards]);

  // Handle board selection
  const handleSelectBoard = (boardId: number) => {
    setActiveBoardId(boardId);
    localStorage.setItem('activeBoardId', boardId.toString());
    setViewMode("board");
  };

  if (isLoadingBoards) {
    return (
      <div className="min-h-screen h-screen flex flex-col w-full overflow-hidden bg-muted">
        <main className="flex-1 overflow-auto pb-6 px-4 sm:px-6 md:px-8">
          <div className="py-6 flex space-x-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[70vh] w-72 rounded-md flex-shrink-0" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (isErrorBoards) {
    return (
      <div className="min-h-screen h-screen flex flex-col w-full overflow-hidden bg-muted">
        <main className="flex-1 overflow-auto pb-6 px-4 sm:px-6 md:px-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Boards</h1>
            <p className="text-muted-foreground">{boardsError?.message || "Something went wrong"}</p>
          </div>
        </main>
      </div>
    );
  }

  // If no boards yet, show loading while we create the default one
  if (!boards || boards.length === 0) {
    return (
      <div className="min-h-screen h-screen flex flex-col w-full overflow-hidden bg-muted">
        <main className="flex-1 overflow-auto pb-6 px-4 sm:px-6 md:px-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-2">Creating your board...</h1>
            <p className="text-muted-foreground">This will just take a moment</p>
          </div>
        </main>
      </div>
    );
  }

  // Find the active board
  const activeBoard = boards.find(board => board.id === activeBoardId) || boards[0];
  
  // Set the active board ID if it's not set yet
  if (!activeBoardId && activeBoard) {
    setActiveBoardId(activeBoard.id);
  }

  return (
    <div className="min-h-screen h-screen flex flex-col w-full overflow-hidden bg-muted">
      <Header 
        board={activeBoard} 
        onBoardListClick={() => setViewMode(viewMode === "board" ? "list" : "board")}
        viewMode={viewMode}
      />
      <main className="flex-1 overflow-auto pb-6 px-4 sm:px-6 md:px-8">
        <div className="py-6">
          {viewMode === "board" ? (
            <BoardComponent 
              board={activeBoard}
              columns={activeBoard.columns || []}
              isLoading={false}
            />
          ) : (
            <BoardList 
              boards={boards} 
              onSelectBoard={handleSelectBoard}
              currentBoardId={activeBoardId}
            />
          )}
        </div>
      </main>
    </div>
  );
}
