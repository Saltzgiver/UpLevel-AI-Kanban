import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Define interface for WebSocket payload
interface TypingPayload {
  type: 'typing';
  cardId: number;
  gptName: string;
  gptColor: string | null;
  isTyping: boolean;
}

interface TypingIndicatorProps {
  cardId: number;
  className?: string;
}

export function TypingIndicator({ cardId, className = '' }: TypingIndicatorProps) {
  const [isTyping, setIsTyping] = useState(false);
  const [aiName, setAiName] = useState<string>('AI');
  const [aiColor, setAiColor] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`[TypingIndicator] Connecting to WebSocket at ${wsUrl}`);
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log(`[TypingIndicator] WebSocket connection established`);
      // Subscribe to updates for this card
      newSocket.send(JSON.stringify({
        type: 'subscribe',
        cardId: cardId,
      }));
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'typing' && data.cardId === cardId) {
          console.log(`[TypingIndicator] Received typing update:`, data);
          setIsTyping(data.isTyping);
          
          if (data.gptName) {
            setAiName(data.gptName);
          }
          
          if (data.gptColor) {
            setAiColor(data.gptColor);
          }
        }
      } catch (error) {
        console.error(`[TypingIndicator] Error processing WebSocket message:`, error);
      }
    };

    newSocket.onerror = (error) => {
      console.error(`[TypingIndicator] WebSocket error:`, error);
    };

    newSocket.onclose = () => {
      console.log(`[TypingIndicator] WebSocket connection closed`);
    };

    setSocket(newSocket);

    // Clean up WebSocket connection when component unmounts
    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.close();
      }
    };
  }, [cardId]);

  // Don't render anything if not typing
  if (!isTyping) return null;

  // Handle color styles based on AI color
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-600";
  
  if (aiColor) {
    // Apply color classes based on the AI's color theme if available
    switch (aiColor) {
      case "Peach":
        bgColor = "bg-[#FEE9D7]";
        textColor = "text-[#E25B3D]";
        break;
      case "Sky":
        bgColor = "bg-[#E1F2FE]";
        textColor = "text-[#2E7EC9]";
        break;
      case "Lavender":
        bgColor = "bg-[#F6E6FF]";
        textColor = "text-[#C235D1]";
        break;
      case "Mint":
        bgColor = "bg-[#DDFFE7]";
        textColor = "text-[#1A9E5E]";
        break;
      case "Aqua":
        bgColor = "bg-[#E0F9FF]";
        textColor = "text-[#3992B0]";
        break;
    }
  }

  return (
    <div className={`flex items-start ${className}`}>
      <div className={`flex items-center gap-2 p-2.5 ${bgColor} rounded-lg max-w-[80%] animate-pulse-gentle transition-opacity`}>
        <div className="relative h-4 w-10">
          <span className={`absolute left-0 w-2 h-2 rounded-full bg-current animate-typing1 opacity-70 ${textColor}`}></span>
          <span className={`absolute left-3 w-2 h-2 rounded-full bg-current animate-typing2 opacity-70 ${textColor}`}></span>
          <span className={`absolute left-6 w-2 h-2 rounded-full bg-current animate-typing3 opacity-70 ${textColor}`}></span>
        </div>
        <span className={`text-sm font-medium ${textColor}`}>
          {aiName} is thinking...
        </span>
      </div>
    </div>
  );
}