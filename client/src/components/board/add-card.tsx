import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface AddCardProps {
  columnId: number;
}

export function AddCard({ columnId }: AddCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAddClick = () => {
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setCardTitle("");
  };

  const handleSubmit = async () => {
    if (!cardTitle.trim()) {
      toast({
        title: "Error",
        description: "Card title cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("POST", `/api/cards`, {
        title: cardTitle,
        columnId,
      });
      setCardTitle("");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      toast({
        title: "Success",
        description: "Card added",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add card",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAdding) {
    return (
      <div className="p-2">
        <Textarea
          placeholder="Enter a title for this card..."
          value={cardTitle}
          onChange={(e) => setCardTitle(e.target.value)}
          className="min-h-[60px] mb-2 border-primary/20 focus-visible:ring-primary/30"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              handleCancel();
            }
          }}
        />
        <div className="flex space-x-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-white rounded-full px-4"
            size="sm"
          >
            Add Card
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCancel} 
            disabled={isSubmitting}
            className="text-muted-foreground rounded-full"
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className="w-full text-left p-2 text-sm text-muted-foreground hover:bg-primary/5 rounded-md transition-colors mt-1"
      onClick={handleAddClick}
    >
      <span className="flex items-center">
        <Plus className="h-4 w-4 mr-1" />
        Add a card
      </span>
    </Button>
  );
}
