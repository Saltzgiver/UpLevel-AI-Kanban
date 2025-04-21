/**
 * Script to fetch and display MCP logs
 */

async function getMcpLogs() {
  try {
    console.log('Fetching MCP logs...');
    
    const url = 'http://localhost:5000/api/mcp/logs';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
    }
    
    const logs = await response.json();
    
    console.log(`Found ${logs.length} MCP logs`);
    
    // Display the latest 3 logs with more details
    const recentLogs = logs.slice(0, 3);
    
    for (const log of recentLogs) {
      console.log('\n===========================================================');
      console.log(`Log ID: ${log.id}`);
      console.log(`Direction: ${log.direction}`);
      console.log(`Endpoint: ${log.endpoint}`);
      console.log(`Status Code: ${log.statusCode}`);
      console.log(`Created At: ${log.createdAt}`);
      console.log(`Error: ${log.error || 'None'}`);
      
      if (log.requestBody) {
        console.log('\nRequest Body:');
        try {
          // Try to parse as JSON first
          const requestBody = JSON.parse(log.requestBody);
          console.log(JSON.stringify(requestBody, null, 2));
        } catch (e) {
          // Otherwise just show the string
          console.log(log.requestBody);
        }
      }
      
      if (log.responseBody) {
        console.log('\nResponse Body:');
        try {
          // Try to parse as JSON first
          const responseBody = JSON.parse(log.responseBody);
          console.log(JSON.stringify(responseBody, null, 2));
        } catch (e) {
          // Otherwise just show the string
          console.log(log.responseBody);
        }
      }
      
      console.log('===========================================================\n');
    }
    
    return logs;
  } catch (error) {
    console.error(`Error fetching MCP logs: ${error.message}`);
    return [];
  }
}

// Run the function
getMcpLogs();
