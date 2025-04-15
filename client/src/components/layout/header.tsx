import { useState } from "react";
import { 
  Edit, 
  Plus, 
  User, 
  LayoutGrid, 
  List, 
  ChevronDown, 
  ChevronUp, 
  KanbanSquare,
  Settings,
  Layout,
  FileText,
  Wrench,
  Bell,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Board } from "@shared/schema";
import { Link } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface HeaderProps {
  board: Board;
  boards: Board[];
  onBoardListClick: () => void;
  viewMode: "board" | "list";
  onSelectBoard: (boardId: number) => void;
  currentBoardId: number | null;
}

export function Header({ board, boards, onBoardListClick, viewMode, onSelectBoard, currentBoardId }: HeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const { toast } = useToast();

  const handleTitleSave = async () => {
    if (boardName.trim() === "") {
      setBoardName(board.name);
      setIsEditingTitle(false);
      return;
    }

    if (boardName === board.name) {
      setIsEditingTitle(false);
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest("PATCH", `/api/boards/${board.id}`, { name: boardName });
      setIsEditingTitle(false);
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      toast({
        title: "Success",
        description: "Board name updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update board name",
        variant: "destructive",
      });
      setBoardName(board.name);
    } finally {
      setIsSaving(false);
    }
  };

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
      await apiRequest("POST", "/api/boards", {
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
      
      // The board will be selected after the query is refreshed
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create board",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete || boards.length <= 1) return;

    try {
      await apiRequest("DELETE", `/api/boards/${boardToDelete.id}`, {});
      
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      
      toast({
        title: "Success",
        description: "Board deleted successfully",
      });
      
      setIsDeleteDialogOpen(false);
      setBoardToDelete(null);
      
      // If we deleted the current board, another one will be selected in the home component
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete board",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 py-2.5 px-4 sticky top-0 left-0 right-0 z-50 shadow-sm w-full">
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center space-x-5">
          {/* Logo */}
          <div className="flex items-center">
            <div className="w-8 h-8 rounded bg-primary/90 flex items-center justify-center text-white mr-2">
              <svg 
                viewBox="0 0 24 24" 
                className="w-5 h-5" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M4 12H20M12 4V20" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Kanban</span>
          </div>
          
          {/* Divider */}
          <div className="h-5 w-px bg-gray-300"></div>
          
          {/* Board Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center text-gray-700">
                <KanbanSquare className="h-4 w-4 mr-2" />
                <span className="mr-1">{viewMode === "board" ? "Boards" : "All Boards"}</span>
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Your Boards</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {boards && boards.length > 0 ? boards.map((b) => (
                <DropdownMenuItem 
                  key={b.id}
                  className={`${currentBoardId === b.id ? 'bg-muted font-medium' : ''} cursor-pointer`}
                  onClick={() => {
                    onSelectBoard(b.id);
                    if (viewMode !== "board") {
                      onBoardListClick();
                    }
                  }}
                >
                  {b.name}
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem disabled>
                  No boards available
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setIsCreateDialogOpen(true)}
                className="text-primary cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" /> 
                Create New Board
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Divider */}
          {viewMode === "board" && (
            <>
              <div className="h-5 w-px bg-gray-300"></div>
              
              {/* Board Title (only when in board view) */}
              <div className="flex items-center">
                {isEditingTitle ? (
                  <div className="flex items-center">
                    <Input
                      className="border border-primary/30 focus-visible:ring-primary/20 h-8 text-sm"
                      value={boardName}
                      onChange={(e) => setBoardName(e.target.value)}
                      autoFocus
                      onBlur={handleTitleSave}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleTitleSave();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setBoardName(board.name);
                          setIsEditingTitle(false);
                        }
                      }}
                      disabled={isSaving}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="ml-2 h-8 border-primary/30 hover:bg-primary/5 transition-colors text-xs font-normal"
                      onClick={handleTitleSave}
                      disabled={isSaving}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <h1 className="text-base font-medium text-gray-800">{board.name}</h1>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-7 px-2 text-gray-600 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsEditingTitle(true)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Share button */}
          <Button
            variant="ghost"
            size="sm"
            className="bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-200 rounded h-8 px-3"
          >
            <span className="flex items-center text-xs">
              Share
            </span>
          </Button>
          
          {/* New Button - visible only in board view */}
          {viewMode === "board" && (
            <Button
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white rounded h-8 px-3"
            >
              <span className="flex items-center text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Card
              </span>
            </Button>
          )}
          
          {/* User Profile Dropdown */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 rounded-full flex items-center">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-medium border border-violet-200">
                    <User className="h-4 w-4" />
                  </div>
                  <ChevronDown className="ml-1 h-4 w-4 text-gray-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Admin</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      admin@example.com
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <Link href="/" className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <Layout className="mr-2 h-4 w-4" />
                    <span>Boards</span>
                  </Link>
                </div>
                <div className="px-2 py-1.5">
                  <div className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </div>
                </div>
                <div className="px-2 py-1.5">
                  <div className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Developer Tools</DropdownMenuLabel>
                <div className="px-2 py-1.5">
                  <Link href="/prompt-analyzer-settings" className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <Wrench className="mr-2 h-4 w-4" />
                    <span>Prompt Analyzer Settings</span>
                  </Link>
                </div>
                <div className="px-2 py-1.5">
                  <Link href="/test-upload" className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    <span>Test Upload</span>
                  </Link>
                </div>
                <div className="px-2 py-1.5">
                  <Link href="/test-suggestion" className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Test Suggestion</span>
                  </Link>
                </div>
                <div className="px-2 py-1.5">
                  <Link href="/direct-toast-test" className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Direct Toast Test</span>
                  </Link>
                </div>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <div className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <span>Log out</span>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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
              disabled={boards.length <= 1}
            >
              Delete Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
