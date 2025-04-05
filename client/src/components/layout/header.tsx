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
    <header className="bg-primary text-white py-3 px-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          {isEditingTitle ? (
            <div className="flex items-center">
              <Input
                className="mr-2 text-foreground bg-white h-8"
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
                className="bg-white/20 text-white border-white/30 hover:bg-white/30 transition-colors"
                onClick={handleTitleSave}
                disabled={isSaving}
              >
                Save
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold">{board.name}</h1>
              <Button
                variant="outline"
                size="sm"
                className="ml-4 bg-white/20 rounded px-2 py-1 text-sm hover:bg-white/30 transition-colors h-8"
                onClick={() => setIsEditingTitle(true)}
              >
                <span className="flex items-center">
                  <Edit className="h-4 w-4 mr-1" />
                  Rename
                </span>
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            className="bg-white/20 rounded px-3 py-1 text-sm hover:bg-white/30 transition-colors h-8 mr-3"
          >
            <span className="flex items-center">
              <Plus className="h-4 w-4 mr-1" />
              Create
            </span>
          </Button>
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
