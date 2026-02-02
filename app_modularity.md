# Application Modularity: Tool Architecture

The Content Toolkit is built on a modular, decoupled architecture that ensures each educational tool operates as an independent unit while sharing core system services.

### 1. Isolated Components
Each tool (e.g., `TAFGenerator`, `WordListProcessor`) is a self-contained React component. They manage their own:
- **UI Internal State**: Local variables, form inputs, and validation logic.
- **File Handling**: Specific parsers for CSV, PDF, or DOCX relevant only to that tool.
- **Error Boundaries**: Tool-specific error handling that prevents a failure in one feature from crashing the entire workspace.

### 2. Stateless Orchestration
The `App.tsx` file acts as a high-level router rather than a complex state manager. 
- It uses a single string state (`currentPage`) to determine which tool to mount. 
- When a user switches tools, the previous tool is unmounted, automatically clearing its memory and temporary state to maintain performance.

### 3. Shared Services Layer
Tools do not communicate with the Gemini API directly. Instead, they consume purpose-built functions from `geminiService.ts`.
- **Abstraction**: This allows the underlying AI logic or model (e.g., switching from Flash to Pro) to be updated for a single tool without modifying the tool's UI code.
- **Reusability**: Core utilities like `validateAndGetClient` and `logUsage` ensure consistent security and tracking across all modules.

### 4. Dynamic Configuration (Rules Over Code)
Modularity extends to logic tuning via the "System Instruction" system:
- Administrators can override a tool's behavior in real-time through the Firestore `configurations` collection.
- This allows for "hot-swapping" the AI's persona or ruleset (e.g., changing TAF whitelist verbs) without a code deployment.

### 5. Role-Based Mounting
Access control is handled at the routing level. The application checks the user's role before mounting a component, allowing us to easily toggle visibility or restricted access for administrative tools like the `SubscriptionTracker`.