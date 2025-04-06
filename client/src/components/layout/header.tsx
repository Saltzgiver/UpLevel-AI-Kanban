import { useState } from "react";
import { Edit, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Board } from "@shared/schema";

interface HeaderProps {
  board: Board;
}

export function Header({ board }: HeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const [isSaving, setIsSaving] = useState(false);
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

  return (
    <header className="bg-white border-b border-gray-200 py-2.5 px-4 sticky top-0 z-10 shadow-sm">
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
          
          {/* Board Title */}
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
          
          {/* New Button */}
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
          
          {/* User Avatar */}
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-medium border border-violet-200">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
