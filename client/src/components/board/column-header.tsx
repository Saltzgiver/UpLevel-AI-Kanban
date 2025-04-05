import { useState, useRef, useEffect } from "react";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AssignGPTModal } from "@/components/ui/assign-gpt-modal";
import { Column } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ColumnHeaderProps {
  column: Column & { cards?: any[] };
  provided: any;
  isEditingTitle: boolean;
  setIsEditingTitle: (value: boolean) => void;
  onDeleteColumn: (columnId: number) => void;
}

export function ColumnHeader({ 
  column, 
  provided, 
  isEditingTitle, 
  setIsEditingTitle,
  onDeleteColumn
}: ColumnHeaderProps) {
  const [title, setTitle] = useState(column.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isGPTModalOpen, setIsGPTModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = async () => {
    if (title.trim() === "") {
      setTitle(column.name);
      setIsEditingTitle(false);
      return;
    }

    if (title === column.name) {
      setIsEditingTitle(false);
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest("PATCH", `/api/columns/${column.id}`, { name: title });
      setIsEditingTitle(false);
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update column name",
        variant: "destructive",
      });
      setTitle(column.name);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between mb-2" {...provided.dragHandleProps}>
      {isEditingTitle ? (
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
            disabled={isSaving}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleTitleSave();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setTitle(column.name);
                setIsEditingTitle(false);
              }
            }}
          />
        </div>
      ) : (
        <h2 className="font-semibold text-sm text-foreground px-2 py-1 flex items-center">
          <span>{column.name}</span>
          <span className="ml-2 text-muted-foreground text-xs">{column.cards?.length || 0}</span>
        </h2>
      )}
      
      <div className="flex">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded">
              <MoreVertical className="h-5 w-5" />
              <span className="sr-only">Column options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
              <Edit className="mr-2 h-4 w-4" />
              <span>Rename</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setIsGPTModalOpen(true)}>
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                <polyline points="7.5 19.79 7.5 14.6 3 12" />
                <polyline points="21 12 16.5 14.6 16.5 19.79" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" x2="12" y1="22.08" y2="12" />
              </svg>
              <span>{column.gptAssigned ? "Configure GPT" : "Assign GPT"}</span>
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => onDeleteColumn(column.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AssignGPTModal
        column={column}
        isOpen={isGPTModalOpen}
        onClose={() => setIsGPTModalOpen(false)}
      />
    </div>
  );
}
