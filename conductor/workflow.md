# Spec-Driven Development Workflow: Kaladhar Studio

## 1. Guiding Principles & Golden Rules
1. **The Plan is the Single Source of Truth**: No code changes or architectural shifts may take place without being formally planned and tracked in Conductor.
2. **Context Persistence Over Chat Memory**: Future agents and human contributors must be able to understand the full system state by reading repository artifacts in conductor/ rather than relying on ephemeral chat histories.
3. **Test-Driven Development (TDD)**: Always write failing tests first (Red), implement code to pass (Green), and refactor with safety.
4. **Broadcast & Mobile Standards**: Every visual and video change must be tested against 9:16 vertical mobile dimensions (1080x1920) and Instagram playback constraints.
5. ** Cloud Cost Constraint**: Preserve the local-first client cache model. Do not introduce billable third-party databases without explicit user authorization.

---

## 2. The Spec-Driven Development (SDD) Lifecycle

Every feature, bug fix, refactor, or track in this repository MUST strictly follow this linear, gated workflow:

`
Requirements
  ↓
Product Specification (spec.md)
  ↓
Technical Architecture
  ↓
Implementation Plan (plan.md)
  ↓
Small Development Tasks
  ↓
Implementation (TDD Red → Green → Refactor)
  ↓
Verification / Testing (Automated + Manual)
  ↓
Code Review
  ↓
Completion & Project Context Synchronization
`

---

### Step 1: Requirements Gathering
- Before writing any code, conduct an interactive scoping session with the user.
- Clarify feature boundaries, user persona impact, and core inputs/outputs.
- Identify edge cases (e.g., non-standard video aspect ratios, slow mobile networks, missing metadata).

### Step 2: Product Specification (spec.md)
- Create the track workspace under conductor/tracks/<track_id>/.
- Author spec.md with:
  - **Overview & Goals**: What is being built and why.
  - **User Stories & User Flows**: Exact step-by-step user interaction.
  - **Functional Requirements**: Granular capability checklist.
  - **Non-Functional Requirements**: Performance, latency, memory limits, and responsive UI.
  - **Acceptance Criteria**: Verifiable assertions for when the feature is acceptable.
  - **Out of Scope**: Explicit boundaries preventing scope creep.
- **User Gate**: Present the drafted spec.md and obtain explicit user approval before proceeding to architecture/planning.

### Step 3: Technical Architecture
- Define component structure, state management, API contracts, schema models, and data flow.
- Ensure changes align with the documented 	ech-stack.md.
- Document any schema or API changes before implementation.

### Step 4: Implementation Plan (plan.md)
- Author plan.md in the track directory, breaking the architecture into sequential, logical **Phases** and **Tasks**.
- Every task MUST be small, atomic, and testable.
- Ensure TDD tasks (writing unit tests) strictly precede feature implementation tasks.
- Format:
  `markdown
  ## Phase 1: Core Foundation
  - [ ] Task: Write failing unit tests for [...]
  - [ ] Task: Implement [...]
  - [ ] Task: Phase Verification & Checkpoint
  `
- **User Gate**: Present the plan to the user for approval.

### Step 5: Small Development Tasks & Status Tracking
- Maintain real-time progress markers:
  - [ ] = Pending
  - [~] = In Progress (actively being executed)
  - [x] <sha> = Completed with associated Git commit SHA.
- Execute tasks strictly one at a time. Never implement multiple unrelated tasks simultaneously.

### Step 6: Implementation (TDD Cycle)
- **Red**: Write unit tests (pytest in ackend/tests/ or component tests in rontend/) and verify that they fail.
- **Green**: Write the minimal application code to make the tests pass.
- **Refactor**: Clean up and optimize while keeping all tests passing.
- **Commit**: Commit each completed task atomically with conventional commit formatting (e.g., eat(editor): add zoom preview).

### Step 7: Verification & Testing
- **Automated Tests**:
  - Backend: Run pytest in ackend/ ensuring all relevant tests pass.
  - Frontend: Run 
pm run build in rontend/ ensuring zero TypeScript/Vite compilation errors.
- **Manual Verification Protocol**:
  - Provide a clear, step-by-step manual test script for the user or agent (URL, actions, expected visual results).
  - Test responsive 9:16 layout across desktop and simulated mobile viewports.

### Step 8: Code Review
- Perform self-review or trigger conductor-review:
  - **Functionality**: Meets all acceptance criteria in spec.md.
  - **Security & Privacy**: No exposed secrets, no unauthorized cloud data leaks.
  - **Design Fidelity**: Follows product-guidelines.md (no generic AI tropes, correct color tokens).
  - **Performance**: Zero frontend jank or backend bottlenecks.

### Step 9: Completion & Context Synchronization
- Update the track status in conductor/tracks.md to [x].
- Update project-level documentation (product.md, 	ech-stack.md, product-guidelines.md) if the new track introduced structural or architectural shifts.
- Commit final track completion to Git.

---

## 3. Standard Development Commands

### Frontend Development
`ash
cd frontend
npm run dev        # Launch Vite development server on http://localhost:5173
npm run build      # Full TypeScript compilation & production build check
npm run lint       # Fast Oxlint code analysis
`

### Backend Development
`ash
# From workspace root
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
.\.venv\Scripts\pytest backend/tests/ -v
`
