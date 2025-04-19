# Starting the Application on Port 3000

Since port 5000 is already in use, we've configured the application to run on port 3000.

## Instructions

### Method 1: Use the Run Button (Preferred)
1. Use the dropdown menu under the "Run" button
2. Select "Start application on port 3000" workflow
3. The application will start on port 3000

### Method 2: Manual Start
If the workflow doesn't work, you can manually start the application:

```bash
node start-on-port-3000.js
```

or

```bash
./run-on-port-3000.sh
```

## Accessing the Application
Once started, the application will be available at: 
http://[your-replit-url]:3000

## Troubleshooting
If you still have issues:
1. Check the console for error messages
2. If you see "port in use" errors, try restarting your Replit
3. Make sure no other process is using port 3000