# AI-Site Backend

Backend for AI-powered website builder (Lovable replica).

## Phase Status

✅ **Phase 1: Virtual File System** - Complete  
✅ **Phase 2: Backend Skeleton** - Complete  
✅ **Phase 3: AI Gateway** - Complete (Cost tracking excluded)  
⏳ **Phase 4: Build Runner** - Next

---

## Phase 1: Virtual File System

### Features
- In-memory file storage
- Versioned snapshots with copy-on-write
- Version management
- Local filesystem storage adapter

### Usage
```typescript
import { VFS } from './src/vfs/VFS.js';
import { VersionManager } from './src/vfs/VersionManager.js';

const vfs = new VFS();
vfs.write('file.txt', 'content');
const versionId = vfs.snapshot();
```

---

## Phase 2: Backend Skeleton

### API Endpoints

#### Sessions
- `POST /api/v1/sessions` - Create a new session
- `GET /api/v1/sessions/:id` - Get session status
- `POST /api/v1/sessions/:id/prompt` - Send user prompt
- `DELETE /api/v1/sessions/:id` - Delete session

#### Streaming
- `GET /api/v1/sessions/:id/stream` - SSE stream for real-time updates

#### Preview
- `GET /preview/:sessionId` - Serve latest valid version
- `GET /preview/:sessionId/:versionId` - Serve specific version

#### Health
- `GET /api/v1/health` - Health check

### Session State Machine

```
CREATED → GENERATING → BUILDING → VALIDATING → READY
   ↓                      ↓            ↓
FAILED ←─────────────────┴────────────┘
   ↓
FIXING → BUILDING
```

**States:**
- `CREATED` - Session just created
- `GENERATING` - AI is generating code
- `BUILDING` - Build is running
- `VALIDATING` - Validating build output
- `READY` - Build complete, preview available
- `FAILED` - Build failed
- `FIXING` - Attempting to fix errors

### Features
- State machine with validated transitions
- Session locking (prevents concurrent builds)
- Automatic cleanup of expired sessions (24 hours)
- SSE streaming for real-time updates
- Preview server stubs

---

## Phase 3: AI Gateway

### Features
- **Gemini API Integration** - Uses Gemini 2.0 Flash model
- **AI Gateway** - `plan()`, `generate()`, and `fix()` methods
- **Context Manager** - Smart file selection and conversation history
- **Orchestrator Pipeline** - Coordinates the entire generation flow

### AI Pipeline

```
User Prompt
  ↓
Planner (identify intent: ADD/MODIFY/DELETE/REFACTOR/CREATE)
  ↓
Context Builder (select relevant files, conversation history)
  ↓
File Generator (produce file changes)
  ↓
VFS Commit (create new version)
  ↓
State Transition (BUILDING → VALIDATING → READY)
```

### Components

1. **GeminiClient** - Wraps Google's Generative AI SDK
   - Timeout handling (30s)
   - Automatic retries with exponential backoff
   - JSON response parsing

2. **AIGateway** - Main AI interface
   - `plan()` - Analyzes prompt and creates implementation plan
   - `generate()` - Generates code files based on plan
   - `fix()` - Fixes build errors

3. **ContextManager** - Manages project context
   - File prioritization (changed files first)
   - Conversation history (last 5 messages)
   - Context compression
   - Dependency extraction

4. **Orchestrator** - Coordinates the pipeline
   - Executes full generation workflow
   - Integrates with VFS and Version Manager
   - Handles error fixing

---

## Installation

```bash
cd backend
npm install
```

## Running

### Development Mode
```bash
npm run dev
```

Server will start on `http://localhost:3000`

### Production
```bash
npm run build
npm start
```

## Environment Variables

Create a `.env` file:

```env
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
GEMINI_API_KEY=your_gemini_api_key_here
```

**Required:**
- `GEMINI_API_KEY` - Your Google Gemini API key (get from https://makersuite.google.com/app/apikey)

## API Examples

### Create Session
```bash
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'
```

### Send Prompt (triggers AI generation)
```bash
curl -X POST http://localhost:3000/api/v1/sessions/{sessionId}/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "build a simple todo list app"}'
```

### Get Session Status
```bash
curl http://localhost:3000/api/v1/sessions/{sessionId}
```

### Stream Events (SSE)
```bash
curl http://localhost:3000/api/v1/sessions/{sessionId}/stream
```

### Preview
```bash
# Latest version
curl http://localhost:3000/preview/{sessionId}

# Specific version
curl http://localhost:3000/preview/{sessionId}/{versionId}
```

## Project Structure

```
backend/
├── src/
│   ├── vfs/                    # Phase 1: Virtual File System
│   │   ├── VFS.ts
│   │   └── VersionManager.ts
│   ├── storage/                # Phase 1: Storage adapters
│   │   └── LocalStorageAdapter.ts
│   ├── sessions/               # Phase 2: Session management
│   │   └── SessionManager.ts
│   ├── streaming/              # Phase 2: SSE streaming
│   │   └── SSEStream.ts
│   ├── ai/                     # Phase 3: AI Gateway
│   │   ├── GeminiClient.ts
│   │   └── AIGateway.ts
│   ├── context/                # Phase 3: Context management
│   │   └── ContextManager.ts
│   ├── orchestrator/           # Phase 3: Orchestration
│   │   └── Orchestrator.ts
│   ├── api/                    # Phase 2: API routes
│   │   ├── server.ts
│   │   └── routes/
│   │       ├── sessions.ts
│   │       ├── streaming.ts
│   │       └── health.ts
│   ├── preview/                # Phase 2: Preview server
│   │   └── previewRoutes.ts
│   ├── types/                  # TypeScript types
│   │   ├── index.ts
│   │   ├── session.ts
│   │   └── ai.ts
│   └── server.ts               # Main entry point
├── storage/                    # Local storage (created at runtime)
├── package.json
├── tsconfig.json
└── .env
```

## Next Steps

- Phase 4: Build Runner (Docker-based isolated builds)
- Phase 5: Real Preview Deployment
