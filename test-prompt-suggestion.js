// Simple test script for getPromptSuggestion function
import { getPromptSuggestion } from './server/openai.ts';

async function runTest() {
  console.log('Testing getPromptSuggestion function...');
  
  // Test data - provide more detailed test data to get a meaningful response
  const sourceColumnInstructions = "Create marketing copy for eco-friendly products.";
  const cardContext = {
    title: "New Eco-Friendly Water Bottle",
    description: "Stainless steel, BPA-free, keeps drinks cold for 24 hours and hot for 12 hours.",
    attachments: []
  };
  
  // Create a series of chats showing user refinement requests
  const chats = [
    {
      role: "assistant",
      content: "Here is some marketing copy for your water bottle: Stay hydrated in style with our revolutionary Eco-Friendly Water Bottle! Made from premium stainless steel, this BPA-free marvel keeps your beverages icy cold for 24 hours or piping hot for 12 hours."
    },
    {
      role: "user",
      content: "Can you make it more focused on the eco-friendly aspects? The environmental impact is important to highlight."
    },
    {
      role: "assistant",
      content: "Absolutely! Save the planet sip by sip with our Eco-Friendly Water Bottle. Crafted from sustainable stainless steel, this zero-waste essential eliminates the need for single-use plastics. BPA-free and built to last, it keeps your drinks perfectly cold for 24 hours or hot for 12 hours while reducing your carbon footprint."
    },
    {
      role: "user", 
      content: "That's better, but could you add something about how many plastic bottles this replaces yearly?"
    },
    {
      role: "assistant",
      content: "Perfect! Save the planet sip by sip with our Eco-Friendly Water Bottle. Crafted from sustainable stainless steel, this zero-waste essential eliminates up to 1,460 single-use plastic bottles every year! BPA-free and built to last, it keeps your drinks perfectly cold for 24 hours or hot for 12 hours while significantly reducing your carbon footprint. Make a difference with every drink!"
    },
    {
      role: "user",
      content: "This is fantastic! Exactly what I needed. The environmental impact numbers really make it compelling."
    }
  ];
  // Use the default API key from the environment
  const apiKey = process.env.OPENAI_API_KEY || null;
  
  try {
    // Call the function
    const result = await getPromptSuggestion(
      sourceColumnInstructions,
      cardContext,
      chats,
      apiKey
    );
    
    // Log the result
    console.log('Function returned:', result);
    console.log('TEST PASSED');
  } catch (error) {
    console.error('ERROR:', error);
    console.log('TEST FAILED');
  }
}

// Run the test
runTest().catch(console.error);