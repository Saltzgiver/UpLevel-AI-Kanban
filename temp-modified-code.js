    // Image generation detection (functionality removed for reimplementation)
    const imageRequestPatterns = [
      /create (?:an|a) image/i,
      /generate (?:an|a) image/i,
      /make (?:an|a) image/i,
      /draw (?:an|a) image/i,
      /create (?:an|a) picture/i,
      /generate (?:an|a) picture/i,
      /make (?:an|a) picture/i,
      /draw (?:an|a) picture/i,
      /show me (?:an|a) image/i,
      /can you create (?:an|a) image/i,
      /image of/i,
      /picture of/i,
      /visualization of/i
    ];

    const isImageRequest = imageRequestPatterns.some(pattern => pattern.test(userMessage));
    
    // Image generation has been temporarily disabled for reimplementation
    if (isImageRequest) {
      console.log(`[IMAGE-HANDLING] Image generation request detected but functionality is disabled for reimplementation`);
      
      // Inform the user that image generation is temporarily disabled
      await storage.createChat({
        cardId,
        role: "assistant",
        content: `⚠️ Image generation is temporarily unavailable as we're improving this feature. Regular chat functionality is still available.`,
        gptName: column.gptName || "AI Assistant",
        gptColor: column.gptColor
      });
      
      // Mark the card as not processing
      await storage.updateCard(cardId, { processing: false });
      return;
    }