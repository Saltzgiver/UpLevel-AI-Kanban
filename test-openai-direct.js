import { OpenAI } from 'openai';

async function testOpenAI() {
  try {
    console.log(`Environment OPENAI_API_KEY available: ${process.env.OPENAI_API_KEY ? "YES (length: " + process.env.OPENAI_API_KEY.length + ")" : "NO"}`);
    
    // Create OpenAI client directly with environment variable
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    
    console.log("Created OpenAI client successfully. Testing with a simple completion...");
    
    // Test a simple completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello world" }
      ],
      max_tokens: 50
    });
    
    console.log("API call successful!");
    console.log("Response:", completion.choices[0].message.content);
    return true;
  } catch (error) {
    console.error("Error testing OpenAI API:", error);
    return false;
  }
}

// Run the test
testOpenAI().then(success => {
  console.log("Test completed with " + (success ? "success" : "failure"));
});