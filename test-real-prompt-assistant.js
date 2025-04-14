/**
 * Test script for the enhanced Prompt Assistant feature
 * 
 * This script tests the real OpenAI-powered prompt suggestion functionality
 */

import fetch from 'node-fetch';

// Sample data to use for testing
const testData = {
  sourceColumnInstructions: "Generate a detailed image based on the card description.",
  cardTitle: "Mountain Landscape",
  cardDescription: "Create an image of a mountain landscape with a lake in the foreground, during sunset.",
  chats: [
    { 
      role: "user", 
      content: "Can you make the mountains more snow-capped and increase the saturation of the sunset colors?" 
    },
    { 
      role: "assistant", 
      content: "I've updated the image with more snow on the mountain peaks and enhanced the sunset colors with deeper oranges and purples. The reflections in the lake now also show these more vibrant sunset hues." 
    },
    { 
      role: "user", 
      content: "Perfect, thank you! Could you also add some small pine trees on the shoreline?" 
    },
    { 
      role: "assistant", 
      content: "I've added a line of pine trees along the shoreline of the lake. They create a nice silhouette against the water and complement the mountain backdrop." 
    }
  ]
};

async function testRealPromptSuggestion() {
  console.log("\n==================================================");
  console.log("TESTING REAL PROMPT SUGGESTION FUNCTIONALITY");
  console.log("==================================================\n");
  
  try {
    console.log("Sending test data to the prompt suggestion endpoint...");
    
    const response = await fetch("http://localhost:5000/api/test-prompt-suggestion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sourceColumnInstructions: testData.sourceColumnInstructions,
        cardTitle: testData.cardTitle,
        cardDescription: testData.cardDescription,
        chats: testData.chats,
        apiKey: "from_env"  // Use the environment API key
      })
    });
    
    if (!response.ok) {
      console.error("Error response:", response.status, response.statusText);
      const errorText = await response.text();
      console.error("Error details:", errorText);
      console.log("❌ Test failed - received error response from the API");
      return;
    }
    
    const result = await response.json();
    
    console.log("\nAPI Response:", JSON.stringify(result, null, 2));
    
    if (result.result || result.suggestion) {
      const suggestion = result.result || result.suggestion;
      console.log("\n✅ Test successful - received suggestion from OpenAI");
      console.log("\nRationale:", suggestion.rationale);
      console.log("\nSuggested Instructions:", suggestion.suggestedInstructions);
    } else {
      console.log("\n❓ Test inconclusive - no suggestion was generated");
      console.log("This could be due to OpenAI determining no improvements were needed");
      console.log("or an error in processing the response");
    }
    
  } catch (error) {
    console.error("Error during test:", error);
    console.log("❌ Test failed");
  }
  
  console.log("\n==================================================");
  console.log("TEST COMPLETE");
  console.log("==================================================\n");
}

// Run the test
testRealPromptSuggestion();