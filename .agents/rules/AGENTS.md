# Antigravity Agent Directives: Spec-Driven Development with Conductor

This repository strictly enforces **Spec-Driven Development (SDD)** powered by **Conductor**.

## Core Directives for All Agents
1. **Single Source of Truth**:
   - Before executing code changes or planning features, you MUST inspect conductor/index.md.
   - Never rely exclusively on conversational chat memory. All product concepts, guidelines, technical architecture, and track plans are maintained in conductor/.

2. **The 8-Stage SDD Lifecycle**:
   Every new feature, architectural modification, or non-trivial fix must follow:
   - **Step 1: Requirements**: Clarify requirements and user stories with the user.
   - **Step 2: Product Specification (spec.md)**: Draft conductor/tracks/<track_id>/spec.md with functional requirements and acceptance criteria. Obtain user approval.
   - **Step 3: Technical Architecture**: Reconcile with conductor/tech-stack.md and define models, schemas, and endpoints.
   - **Step 4: Implementation Plan (plan.md)**: Break the feature into small, atomic tasks where tests strictly precede code (TDD). Obtain user approval.
   - **Step 5: Small Development Tasks**: Track tasks in plan.md using [ ] -> [~] -> [x] <sha>.
   - **Step 6: Implementation**: Red (failing test) -> Green (pass test) -> Refactor.
   - **Step 7: Verification & Testing**: Run automated tests (pytest, 
pm run build) and perform manual UX verification against 9:16 mobile constraints.
   - **Step 8: Code Review & Completion**: Validate against conductor/product-guidelines.md (zero AI tropes, high-end editorial feel), mark track complete in conductor/tracks.md, and synchronize core project docs.

3. **Artifact Locations**:
   - Master Index: conductor/index.md
   - Product Definition: conductor/product.md
   - UX & Guidelines: conductor/product-guidelines.md
   - Tech Stack & Arch: conductor/tech-stack.md
   - Workflow & Standards: conductor/workflow.md
   - Code Style Guides: conductor/code_styleguides/
   - Tracks Registry: conductor/tracks.md
   - Active & Completed Track Workspaces: conductor/tracks/<track_id>/
