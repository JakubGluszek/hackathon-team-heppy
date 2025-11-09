---
alwaysApply: true
---

## Phase 1: Database Schema

**Goal**: Create `graphs` table and relations.

### Tasks

- [x] Add `graphs` table to `src/server/db/schema.ts`:
  - Fields: `id`, `userId`, `name`, `sourceType`, `inputMeta`, `inputText`, `status`, `graphJson`, `createdAt`, `updatedAt`
  - Indexes on `userId`, `createdAt`
  - Foreign key to `user.id` with cascade delete
- [x] Add `sourceType` and `status` enums to schema
- [x] Generate migration: `SKIP_ENV_VALIDATION=1 pnpm db:generate`
- [x] **Human action required**: Review generated migration in `drizzle/` folder → Migration looks good: `drizzle/0001_broad_alex_power.sql`
- [ ] Apply migration: `pnpm db:push` (requires DATABASE_URL env var)

### Validation

```bash
pnpm db:studio  # open Drizzle Studio, verify `graphs` table exists with correct columns
```

---

## Phase 2: Utility Functions

**Goal**: Create shared utilities for graph generation.

### Tasks

- [x] Create `src/lib/graph-utils.ts`:
  - `generateNodeId(label: string): string` - SHA256 hash of normalized label (16 chars)
  - `chunkText(text: string, chunkSize: number, overlap: number): string[]` - word-based chunking
  - `normalizeEntity(entity: string): string` - lowercase, trim, remove stopwords
  - `limitPredicateLength(predicate: string, maxWords: number): string` - enforce 3-word max
  - `extractJsonFromText(text: string): any` - robust JSON extraction from LLM response
- [x] Create `src/lib/prompts.ts`:
  - `TOPIC_GENERATION_PROMPT` - template for generating source text from topic
  - `TRIPLE_EXTRACTION_SYSTEM_PROMPT` - system prompt for extraction (see specification.mdc)
  - `TRIPLE_EXTRACTION_USER_PROMPT` - user prompt template with rules
  - `TRIPLE_EXTRACTION_JSON_SCHEMA` - JSON schema for structured output
- [ ] Add basic unit tests (optional but recommended)

### Validation

```bash
# Manual test in Node REPL or simple test file
node -e "const { chunkText } = require('./src/lib/graph-utils'); console.log(chunkText('test'.repeat(100), 50, 10));"
```

### Reference

See `.cursor/context/kg-extraction-reference.md` for detailed algorithms:

- Section 1: Text Chunking Algorithm
- Section 2: LLM Prompts
- Section 3: JSON Extraction
- Section 5: Predicate Length Enforcement

---

## Phase 3: API Route - Create Graph

**Goal**: Implement `POST /api/graphs/create` endpoint.

### Tasks

- [x] Create `src/app/api/graphs/create/route.ts`
- [x] Implement auth check (Better Auth session)
- [x] Implement concurrency check (max 1 building graph per user)
- [x] Implement input validation (topic XOR inputText, size ≤ 50k chars)
- [x] If topic provided: call OpenAI to generate source text, store in `inputText`
- [x] Create `graphs` record with status `pending`
- [x] Return `{ graphId }` JSON response
- [x] Handle errors and return appropriate status codes

### Validation

```bash
# Test with curl (requires active session cookie)
curl -X POST http://localhost:3000/api/graphs/create \
  -H "Content-Type: application/json" \
  -d '{"topic":"Biology"}' \
  -b "better-auth.session_token=..."

# Should return: {"graphId":"..."}
```

---

## Phase 4: API Route - Stream Graph (Stub)

**Goal**: Implement `GET /api/graphs/stream?graphId=...` with SSE, stub data first.

### Tasks

- [x] Create `src/app/api/graphs/stream/route.ts`
- [x] Implement auth check and verify user owns graph
- [x] Set up SSE headers (`text/event-stream`, `no-cache`, `keep-alive`)
- [x] Update graph status to `building`
- [x] **Stub implementation**: send test events (2 nodes, 1 edge, complete) with delays
- [x] Use `event: status`, `event: node`, `event: edge`, `event: complete` format
- [x] Update graph status to `complete` and save stub `graphJson`
- [x] Handle errors and emit `event: error`

### Validation

```bash
# Test with curl
curl -N http://localhost:3000/api/graphs/stream?graphId=... \
  -H "Cookie: better-auth.session_token=..."

# Should stream:
# event: status
# data: {"message":"Starting graph generation..."}
#
# event: node
# data: {"node":{"id":"test1","label":"Biology","group":"extracted","weight":1}}
# ...
```

---

## Phase 5: Client - Create Form & Graph List

**Goal**: Build home page with create form and "My Graphs" list.

### Tasks

- [x] Update `src/app/page.tsx`:
  - Add create form (topic input OR file upload, name optional)
  - Add submit handler calling `/api/graphs/create`
  - On success, redirect to `/graphs/[graphId]`
- [x] Create tRPC router `src/server/api/routers/graphs.ts`:
  - `list` procedure: fetch user's graphs ordered by `createdAt DESC`
- [x] Add graphs router to `src/server/api/root.ts`
- [x] Display graphs list on home page with links to `/graphs/[id]`

### Validation

```bash
pnpm dev
# Navigate to http://localhost:3000
# Log in, submit form with topic "Biology"
# Should redirect to /graphs/[id]
# Return to home, verify graph appears in list
```

---

## Phase 6: Client - Graph Viewer with SSE (Stub Data)

**Goal**: Build graph detail page with `react-force-graph-2d` and EventSource.

### Tasks

- [ ] Create `src/app/graphs/[id]/page.tsx`
- [ ] Fetch graph metadata (name, status) via tRPC or direct fetch
- [ ] Create `src/hooks/useGraphStream.ts`:
  - Accept `graphId`, return `{ nodes, edges, status, error }`
  - Use `EventSource` to connect to `/api/graphs/stream?graphId=...`
  - Parse SSE events and update state
  - Handle reconnection on error
- [ ] Render `ForceGraph2D` from `react-force-graph-2d`:
  - Pass `graphData={{ nodes, links: edges }}`
  - Configure node/link appearance
  - Add loading indicator while status is "building"
- [ ] Add basic controls: "Reset View" button

### Validation

```bash
pnpm dev
# Create graph from home page
# Observe stub nodes/edges appear in real-time on canvas
# Verify "Complete" status shows when done
```

---

## Phase 7: Pipeline - LLM Integration (Real Data)

**Goal**: Replace stub with real chunking → extraction → streaming.

### Tasks

- [ ] Create `src/lib/graph-pipeline.ts`:
  - `extractTriplesFromChunk(chunk: string): Promise<Triple[]>` - call OpenAI with extraction prompt
  - `buildGraphFromText(text: string): AsyncGenerator<StreamEvent>` - orchestrate chunking, extraction, emit events
  - Use robust JSON extraction (`extractJsonFromText`)
  - Validate all triples (subject, predicate, object present)
  - Enforce predicate length limit (3 words max)
  - Apply basic entity normalization
- [ ] Update `src/app/api/graphs/stream/route.ts`:
  - Remove stub logic
  - Call `buildGraphFromText(inputText)` and forward events to SSE stream
  - Accumulate nodes/edges in Map for deduplication by ID
  - Save final `graphJson` on completion
- [ ] Add error handling for LLM failures (rate limits, timeouts)
- [ ] Implement node cap enforcement (300 soft warn, 500 hard stop)

### Validation

```bash
pnpm dev
# Create graph with topic "Quantum Physics"
# Observe real nodes/edges extracted from generated text
# Verify graph makes semantic sense
# Check database: `graphJson` should contain full graph
```

### Reference

See `.cursor/context/kg-extraction-reference.mdc` for:

- Section 9: Processing Pipeline Flow
- Section 11: Error Handling Patterns
- Section 12: TypeScript Implementation (Async Generators)

---

## Phase 8: Pipeline - Inference (Optional Stretch)

**Goal**: Add minimal transitive inference for inferred edges.

### Tasks

- [ ] Create `src/lib/inference.ts`:
  - `inferTransitiveRelationships(nodes, edges): Edge[]` - depth-1 transitive rules (A→B, B→C ⇒ A→C)
  - `inferByLexicalSimilarity(nodes, edges): Edge[]` - connect entities with shared words/stems
  - Cap inferred edges at 1.5× extracted
  - Skip if extracted edge already exists
  - Always mark with `type: "inferred"`
- [ ] Integrate into `buildGraphFromText` after extraction complete
- [ ] Emit `edge` events with `type: "inferred"`

### Validation

```bash
# Create graph, verify some edges have type "inferred"
# Use filter toggle to hide/show inferred edges
```

### Reference

See `.cursor/context/kg-extraction-reference.mdc` for:

- Section 6: Relationship Inference algorithms
- Section 6.1: Transitive Inference
- Section 6.2: Lexical Similarity Inference

---

## Phase 9: UI Polish

**Goal**: Add controls, search, theme toggle, node interactions.

### Tasks

- [ ] Add toolbar to `/graphs/[id]`:
  - Toggle labels (show/hide node labels)
  - Filter by edge type (extracted, inferred, all)
  - Search input (highlight + zoom to matching nodes)
  - Reset view button
  - Theme toggle (dark/light via `next-themes`)
- [ ] Add node hover popover:
  - Show node label + degree count
  - Empty "View connections" button (wire event only for MVP)
- [ ] Add node click handler: center node in viewport
- [ ] Style improvements: responsive layout, loading states, error boundaries

### Validation

```bash
# Test all controls interactively
# Toggle theme, verify graph colors adapt
# Search for node, verify highlight and zoom
# Click node, verify centering
```

---

## Phase 10: Final Integration & Testing

**Goal**: End-to-end testing and bug fixes.

### Tasks

- [ ] Test full flows:
  - Create graph from topic → stream → view → return to list
  - Upload .txt file → stream → view
  - Create multiple graphs, verify list ordering
  - Test error cases (invalid input, network errors, LLM failures)
- [ ] Test concurrency limit (try creating 2 graphs simultaneously)
- [ ] Performance test: create graph with large text (~50k chars), verify soft/hard caps
- [ ] Fix any critical bugs
- [ ] Add simple error boundaries in UI
- [ ] Add logging for debugging (console logs OK for hackathon)

### Validation

```bash
# Full end-to-end manual test
# Invite teammate to test independently
# Fix any showstopper bugs
```

---

## Phase 11: Demo Preparation

**Goal**: Polish for demo presentation.

### Tasks

- [ ] Prepare demo data: 2-3 interesting topics (e.g., "Quantum Computing", "Impressionism", "Blockchain")
- [ ] Pre-generate graphs if needed (for backup if live demo fails)
- [ ] Test on demo hardware/network
- [ ] Prepare talking points:
  - Problem: knowledge graphs are hard to build
  - Solution: AI-powered real-time generation
  - Demo: topic → live graph → exploration
- [ ] Screenshots/recording for fallback

---

## Phase Notes

### Phase 5 (Date: 2025-11-09)

**Status**: Home page and graph list complete

**Completed**:

- Created `CreateGraphForm` component:
  - Tabbed interface (topic vs upload)
  - Topic input with AI generation
  - Text area for file content upload (50k char validation)
  - Optional name field
  - Form validation and loading states
  - Redirects to graph viewer on success
- Created `GraphsList` component:
  - Fetches graphs via tRPC
  - Displays graph cards with metadata (name, type, status, timestamp)
  - Delete functionality with confirmation
  - Real-time updates via tRPC mutations
  - Empty state handling
- Updated home page with:
  - Two-column layout (form + list)
  - Auth guard (redirects to /login if not logged in)
  - Header with user info and sign out
  - Beautiful gradient background
- Added Toaster component to layout for notifications

**Architecture**:

- Form uses direct fetch to REST `/api/graphs/create`
- List uses tRPC `graphs.list` and `graphs.delete`
- This follows the hybrid approach: REST for create/stream, tRPC for CRUD

**Next**: Graph viewer with ForceGraph2D and SSE

---

### Phase 2 (Date: 2025-11-09)

**Status**: Utility functions complete

**Completed**:

- Created `src/lib/graph-utils.ts` with:
  - `generateNodeId()`: SHA256 hash-based ID generation (16 chars)
  - `chunkText()`: Word-based text chunking with overlap
  - `normalizeEntity()`: Entity normalization (lowercase, stopwords)
  - `limitPredicateLength()`: Enforce 3-word max for predicates
  - `extractJsonFromText()`: Robust JSON parsing with fallbacks
- Created `src/lib/prompts.ts` with:
  - `getTopicGenerationPrompt()`: Topic → text generation prompt
  - `TRIPLE_EXTRACTION_SYSTEM_PROMPT`: System prompt with 3-word rule
  - `getTripleExtractionUserPrompt()`: Detailed extraction instructions
  - `TRIPLE_EXTRACTION_JSON_SCHEMA`: JSON schema for structured output
- All utilities include comprehensive error handling and edge cases

---

### Phase 3 (Date: 2025-11-09)

**Status**: Create endpoint complete

**Completed**:

- Created `src/app/api/graphs/create/route.ts` (REST endpoint per spec)
- Implemented Better Auth session validation
- Added concurrency check (max 1 building graph per user)
- Input validation with Zod (topic XOR inputText)
- OpenAI integration for topic → text generation (gpt-4o-mini)
- Graph record creation with proper metadata
- Size validation (50k char limit)
- Comprehensive error handling

**Design Decision**:

- Used REST for create endpoint (not tRPC) per specification
- Reasoning: Pairs with streaming endpoint, may support file uploads later
- tRPC reserved for simple CRUD operations (list, fetch, delete)

---

### Phase 4 (Date: 2025-11-09)

**Status**: Streaming endpoint stub complete

**Completed**:

- Created `src/app/api/graphs/stream/route.ts` (REST with SSE)
- Implemented SSE response with proper headers
- Auth check and ownership verification
- Status updates: pending → building → complete
- Stub data: 3 nodes (biology, cell, mitosis) + 2 edges
- Event types: `status`, `node`, `edge`, `complete`, `error`
- Graph JSON persistence to database
- Ready to replace with real pipeline in Phase 7

---

### Phase 5 (Date: 2025-11-09)

**Status**: tRPC router complete

**Completed**:

- Created `src/server/api/routers/graphs.ts` with procedures:
  - `list`: Fetch user's graphs (newest first)
  - `getById`: Fetch single graph with ownership check
  - `delete`: Delete graph with ownership verification
- Added router to `src/server/api/root.ts`
- All procedures use `protectedProcedure` (auth required)
- Type-safe with full TypeScript inference

**Next**: Frontend implementation (home page + graph viewer)

---

### Phase 1 (Date: 2025-11-09)

**Status**: Schema complete, migration generated, ready for database push

**Completed**:

- Added `source_type` enum with values: `topic`, `upload`
- Added `graph_status` enum with values: `pending`, `building`, `complete`, `error`
- Created `graphs` table (using `createTable` with `pg-drizzle_` prefix):
  - `id`: text (UUID, auto-generated)
  - `userId`: text, foreign key to `user.id` with cascade delete
  - `name`: text, required
  - `sourceType`: enum, required
  - `inputMeta`: jsonb, nullable
  - `inputText`: text, required
  - `status`: enum, required, default `pending`
  - `graphJson`: jsonb, nullable
  - `createdAt`: timestamp with timezone, auto-set
  - `updatedAt`: timestamp with timezone, auto-update
- Added indexes on `userId` and `createdAt`
- Added relations: `userRelations` includes `graphs`, `graphRelations` references `user`
- Generated migration: `drizzle/0001_broad_alex_power.sql`

**Next Steps**:

- Human needs to ensure database is running and `.env` has `DATABASE_URL`
- Run `pnpm db:push` to apply migration
- Verify with `pnpm db:studio`

**Dependencies Added**:

- `openai` v6.8.1
- `react-force-graph-2d` v1.29.0

**Environment Variables Added**:

- `OPENAI_API_KEY` to `src/env.js`

---

### Phase 0 (Date: YYYY-MM-DD)

_Add implementation notes here as you complete phases_

---

## Known Issues / Tech Debt

_Track any deferred issues or quick hacks here_

- Example: "Hardcoded 500ms delay in SSE for demo effect (remove for production)"

---

## Success Criteria

- [x] User can log in with Google
- [ ] User can create graph from topic
- [ ] Graph streams in real-time to canvas
- [ ] User can view past graphs in "My Graphs"
- [ ] Search and filter controls work
- [ ] Demo-ready: no critical bugs, runs smoothly
