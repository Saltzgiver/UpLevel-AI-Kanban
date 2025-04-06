import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface AddColumnProps {
  boardId: number;
}

export function AddColumn({ boardId }: AddColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAddClick = () => {
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setColumnName("");
  };

  const handleSubmit = async () => {
    if (!columnName.trim()) {
      toast({
        title: "Error",
        description: "Column name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("POST", `/api/columns`, {
        name: columnName,
        boardId,
      });
      setColumnName("");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      toast({
        title: "Success",
        description: "Column added",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add column",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAdding) {
    return (
      <div className="column bg-muted/50 rounded-md shadow-sm w-72 flex-shrink-0 p-2">
        <div className="mb-2">
          <Input
            placeholder="Enter column name..."
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
              }
            }}
          />
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            Add Column
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="column bg-muted/50 rounded-md shadow-sm w-72 flex-shrink-0 border-2 border-dashed border-border flex items-center justify-center">
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-foreground p-4 w-full h-full"
        onClick={handleAddClick}
      >
        <div className="flex flex-col items-center">
          <Plus className="h-8 w-8 mb-2" />
          <span>Add another column</span>
        </div>
      </Button>
    </div>
  );
}
