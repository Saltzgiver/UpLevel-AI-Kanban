import { Sparkles, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AssignGPTModal } from "@/components/ui/assign-gpt-modal";
import { Column } from "@shared/schema";

// Define color palette
type ColorName = "Peach" | "Sky" | "Lavender" | "Mint" | "Aqua";

type ColorStyles = {
  bgGradient: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
};

const colorPalette: Record<ColorName, ColorStyles> = {
  "Peach": { 
    bgGradient: "from-[#FEE9D7]/70 to-[#F7C9B0]/40", 
    borderColor: "border-[#F7C9B0]", 
    textColor: "text-[#E25B3D]",
    iconColor: "text-[#E25B3D]"
  },
  "Sky": { 
    bgGradient: "from-[#E1F2FE]/70 to-[#B7DCF7]/40", 
    borderColor: "border-[#B7DCF7]", 
    textColor: "text-[#2E7EC9]",
    iconColor: "text-[#2E7EC9]"
  }, 
  "Lavender": { 
    bgGradient: "from-[#F6E6FF]/70 to-[#E9CEFB]/40", 
    borderColor: "border-[#E9CEFB]", 
    textColor: "text-[#C235D1]",
    iconColor: "text-[#C235D1]"
  },
  "Mint": { 
    bgGradient: "from-[#DDFFE7]/70 to-[#C1EDD4]/40", 
    borderColor: "border-[#C1EDD4]", 
    textColor: "text-[#1A9E5E]",
    iconColor: "text-[#1A9E5E]"
  },
  "Aqua": { 
    bgGradient: "from-[#E0F9FF]/70 to-[#C3E8F4]/40", 
    borderColor: "border-[#C3E8F4]", 
    textColor: "text-[#3992B0]",
    iconColor: "text-[#3992B0]"
  }
};

// Helper to safely get color styles
const getColorStyle = (colorName: string | null | undefined, defaultColor: ColorName = "Peach"): ColorStyles => {
  if (colorName && colorName in colorPalette) {
    return colorPalette[colorName as ColorName];
  }
  return colorPalette[defaultColor];
};

interface GPTBannerProps {
  column: Column;
}

export function GPTBanner({ column }: GPTBannerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (column.gptAssigned) {
    const colorStyle = getColorStyle(column.gptColor);
    
    return (
      <div className={`bg-gradient-to-r ${colorStyle.bgGradient} ${colorStyle.borderColor} rounded-lg mb-3 p-3 text-sm shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Sparkles className={`h-5 w-5 mr-2 ${colorStyle.iconColor}`} />
            <span className={`font-semibold ${colorStyle.textColor}`}>
              {column.gptName || "GPT Assistant"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground p-1 rounded"
            onClick={() => setIsModalOpen(true)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="mt-1 pl-7 text-xs text-gray-600">
          {column.gptInstructions && column.gptInstructions.length > 60 
            ? column.gptInstructions.substring(0, 60) + "..."
            : column.gptInstructions || "Write a paragraph about this"}
        </div>
        
        <AssignGPTModal
          column={column}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-muted/50 border border-border/70 border-dashed rounded-lg mb-3 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Sparkles className="h-4 w-4 mr-2 text-muted-foreground/60" />
          <span className="text-muted-foreground text-xs">GPT not assigned</span>
        </div>
        
        <Button
          size="sm"
          className="bg-primary text-white text-xs py-1 px-3 h-7 rounded-md hover:bg-primary/90 transition-colors"
          onClick={() => setIsModalOpen(true)}
        >
          Automate
        </Button>
      </div>
      
      <AssignGPTModal
        column={column}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
