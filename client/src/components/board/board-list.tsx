import { useState } from "react";
import { Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Board } from "@shared/schema";

interface BoardListProps {
  boards: Board[];
  onSelectBoard: (boardId: number) => void;
  currentBoardId: number | null;
}

export function BoardList({ boards, onSelectBoard, currentBoardId }: BoardListProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const { toast } = useToast();

  const handleCreateBoard = async () => {
    if (newBoardName.trim() === "") {
      toast({
        title: "Error",
        description: "Board name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await apiRequest("POST", "/api/boards", {
        name: newBoardName,
        userId: null, // No user ID required
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      
      toast({
        title: "Success",
        description: "Board created successfully",
      });
      
      setNewBoardName("");
      setIsCreateDialogOpen(false);
      
      // Select the newly created board after refetch
      // Rather than using the response directly, we'll refetch to get the full board data
      // and avoid type issues
      setTimeout(() => {
        const fetchBoards = async () => {
          try {
            const boards = await apiRequest("GET", "/api/boards", {}) as any[];
            // Find the board with the matching name we just created
            const newBoard = boards.find(b => b.name === newBoardName);
            if (newBoard && newBoard.id) {
              onSelectBoard(newBoard.id);
            }
          } catch (error) {
            console.error("Failed to fetch boards after creation:", error);
          }
        };
        fetchBoards();
      }, 500);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create board",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  const handleDeleteBoard = async () => {
    if (!boardToDelete) return;

    try {
      await apiRequest("DELETE", `/api/boards/${boardToDelete.id}`, {});
      
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      
      toast({
        title: "Success",
        description: "Board deleted successfully",
      });
      
      setIsDeleteDialogOpen(false);
      setBoardToDelete(null);
      
      // If we deleted the current board, select another one
      if (currentBoardId === boardToDelete.id && boards.length > 1) {
        const otherBoard = boards.find(b => b.id !== currentBoardId);
        if (otherBoard) {
          onSelectBoard(otherBoard.id);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete board",
        variant: "destructive",
      });
    }
  }

  const openDeleteDialog = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent board selection when clicking delete
    setBoardToDelete(board);
    setIsDeleteDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Boards</h2>
        <Button
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Board
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => (
          <Card 
            key={board.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              currentBoardId === board.id ? 'border-primary border-2' : ''
            }`}
            onClick={() => onSelectBoard(board.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                <span className="truncate">{board.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => openDeleteDialog(board, e)}
                  disabled={boards.length <= 1}
                  title={boards.length <= 1 ? "Cannot delete the only board" : "Delete board"}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-muted-foreground">
                {(board as any).columns?.length || 0} columns
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => onSelectBoard(board.id)}
              >
                Open Board
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Create Board Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
            <DialogDescription>
              Give your board a name to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="boardName">Board Name</Label>
            <Input 
              id="boardName"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="e.g., Project Alpha"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateBoard();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBoard}
              disabled={isCreating || newBoardName.trim() === ""}
            >
              {isCreating ? "Creating..." : "Create Board"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Board Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Board</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{boardToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setBoardToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteBoard}
            >
              Delete Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}