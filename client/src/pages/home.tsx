import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { BoardComponent } from "@/components/board/board";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Board } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  
  // Query for all boards (we'll use the first one)
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

  // Use the first board if available, otherwise use a safe default
  const activeBoard = boards && boards.length > 0 ? boards[0] : null;
  
  // Handle the case where board data might be empty but not caught by earlier conditions
  if (!activeBoard) {
    return (
      <div className="min-h-screen h-screen flex flex-col w-full overflow-hidden bg-muted">
        <main className="flex-1 overflow-auto pb-6 px-4 sm:px-6 md:px-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-2">Loading board data...</h1>
            <p className="text-muted-foreground">Please wait or refresh the page if this persists</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col w-full overflow-hidden bg-muted">
      <main className="flex-1 overflow-auto pb-6 px-4 sm:px-6 md:px-8">
        <div className="py-6">
          <BoardComponent 
            board={activeBoard}
            columns={activeBoard.columns || []}
            isLoading={false}
          />
        </div>
      </main>
    </div>
  );
}
