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
      <div className="min-h-screen bg-muted flex flex-col">
        <div className="bg-white border-b border-gray-200 py-2.5 px-4 sticky top-0 z-10 shadow-sm">
          <div className="w-full flex items-center justify-between">
            <Skeleton className="h-8 w-64 bg-gray-200" />
            <Skeleton className="h-8 w-32 bg-gray-200" />
          </div>
        </div>
        <main className="w-full py-6 px-4 sm:px-6 md:px-8 flex-grow">
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
      <div className="min-h-screen bg-muted flex flex-col">
        <div className="bg-white border-b border-gray-200 py-2.5 px-4 sticky top-0 z-10 shadow-sm">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded bg-primary/90 flex items-center justify-center text-white mr-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12H20M12 4V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Kanban</span>
            </div>
          </div>
        </div>
        <main className="w-full py-6 px-4 sm:px-6 md:px-8 flex-grow flex items-center justify-center">
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
      <div className="min-h-screen bg-muted flex flex-col">
        <div className="bg-white border-b border-gray-200 py-2.5 px-4 sticky top-0 z-10 shadow-sm">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded bg-primary/90 flex items-center justify-center text-white mr-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12H20M12 4V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Kanban</span>
            </div>
          </div>
        </div>
        <main className="w-full py-6 px-4 sm:px-6 md:px-8 flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-2">Creating your board...</h1>
            <p className="text-muted-foreground">This will just take a moment</p>
          </div>
        </main>
      </div>
    );
  }

  // Use the first board
  const activeBoard = boards[0];

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <Header board={activeBoard} />
      <main className="w-full py-6 px-4 sm:px-6 md:px-8 flex-grow">
        <BoardComponent 
          board={activeBoard}
          columns={activeBoard.columns || []}
          isLoading={false}
        />
      </main>
    </div>
  );
}
