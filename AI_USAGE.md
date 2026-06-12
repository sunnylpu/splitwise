# AI Usage Log (AI_USAGE.md)

## AI Tools Used
- Google Gemini (Advanced Agentic AI Assistant)

## Key Prompts Used
1. "Build a Splitwise clone with Firebase, React, Vite. Include equal, unequal, percentage, and shares splits. Add expense chat."
2. "What do I need to deploy this to Vercel? I downloaded the zip from AI studio."
3. "Error saving rules - Line 4: The 'service' body must contain at least one declaration."

## Concrete Cases of AI Errors & Corrections

### Case 1: AI Generated Invalid Firebase Rules Syntax
- **What happened**: When generating the `firestore.rules` file initially, the AI included an empty block `service cloudfastpath { // Let's name it cloud.firestore to comply with standard firebase format }` right above the valid `service cloud.firestore` block.
- **How I caught it**: When pasting the rules into the Firebase Console to deploy the database, the console threw a syntax error: `"Error saving rules - Line 4: The 'service' body must contain at least one declaration."`
- **What I changed**: Prompted the AI with the exact error. The AI removed the invalid empty `service cloudfastpath` block, leaving only the valid `service cloud.firestore` declaration, allowing successful deployment.

### Case 2: AI Inserted JavaScript into a JSON Configuration File
- **What happened**: While updating the Firebase deployment configuration for Vercel, the AI generated actual JavaScript code (import statements, `const app = initializeApp()`) and appended it directly inside the `firebase-applet-config.json` file.
- **How I caught it**: The IDE immediately highlighted syntax errors because JSON files do not support JavaScript comments or code execution. The Vite build would also fail if it attempted to parse the invalid JSON.
- **What I changed**: Pointed out to the AI that it had pasted JS code into a JSON file. The AI utilized a file-write tool to completely replace the file contents with strict, properly formatted JSON containing only the credentials.

### Case 3: AI Initially Relied on a Local 'AI Studio' Firebase Environment
- **What happened**: The AI generated the initial codebase using an internal AI Studio Firebase project ID (`firestoreDatabaseId: "ai-studio-cfcae124..."`). This configuration only worked inside the isolated AI Studio sandbox.
- **How I caught it**: When trying to deploy to Vercel, I asked the AI what was needed. The AI realized that the current configuration was tightly coupled to the AI Studio environment and would fail in a public deployment because it lacked standard Authentication and open Firestore access.
- **What I changed**: Instructed the AI to prepare the app for Vercel. The AI provided steps to create a completely new, standalone Firebase project, and we swapped out the internal AI Studio config with the new public credentials.
