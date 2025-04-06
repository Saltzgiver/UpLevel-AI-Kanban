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
      <div className="min-h-screen bg-muted">
        <div className="bg-primary text-white py-3 px-4 shadow-md">
          <div className="w-full flex items-center justify-between">
            <Skeleton className="h-8 w-64 bg-white/20" />
            <Skeleton className="h-8 w-32 bg-white/20" />
          </div>
        </div>
        <main className="w-full py-6 px-1">
          <div className="flex space-x-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[70vh] w-72 rounded-md" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (isErrorBoards) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Boards</h1>
          <p className="text-muted-foreground">{boardsError?.message || "Something went wrong"}</p>
        </div>
      </div>
    );
  }

  // If no boards yet, show loading while we create the default one
  if (!boards || boards.length === 0) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Creating your board...</h1>
          <p className="text-muted-foreground">This will just take a moment</p>
        </div>
      </div>
    );
  }

  // Use the first board
  const activeBoard = boards[0];

  return (
    <div className="min-h-screen bg-muted">
      <Header board={activeBoard} />
      <main className="w-full py-6 px-1">
        <BoardComponent 
          board={activeBoard}
          columns={activeBoard.columns || []}
          isLoading={false}
        />
      </main>
    </div>
  );
}
