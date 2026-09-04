# Product Guidelines: Kaladhar Studio

## 1. Brand Identity & Design Philosophy
Kaladhar represents artisanal heritage blended with modern digital craftsmanship. It is designed for creative boutique directors who take pride in Indian textiles and craftsmanship.

### Core Brand Pillars
- **Artisanal Luxury**: Evoke the tactile richness of handloom silk, zari weaves, and high-fashion editorial lookbooks.
- **Precision Workstation**: Act as a focused, high-performance creative tool—similar to Runway, DaVinci Resolve, or Linear—not a generic AI gimmick.
- **Zero AI Clichés**: Never use cartoonish sparkles, fake step-by-step onboarding cards, deceptive progress bars, or synthetic robot mascots. Everything in the interface must feel purposeful, professional, and authentic.

---

## 2. Visual Design & Theme System

### Dual-Theme Tokens
- **Dark Mode (Default Studio Canvas)**:
  - Background: Deep obsidian (#0A0A0C), elevated card surfaces (#111115, #18181B).
  - Text: Clean high-contrast neutral (#EDEDED) with muted labels (#A1A1AA).
  - Accent: High-energy saffron orange (#FF611A to #FC731C).
- **Light Mode (Warm Editorial Canvas)**:
  - Background: Warm unbleached parchment (#F7F6F3), card surfaces (#FFFFFF, #FAF8F5).
  - Text: Deep charcoal/ink (#0A0A0C) with secondary contrast (#52525B).
  - Accent: Vibrant terracotta saffron (#FF611A).

### Typography Standard
- **Primary Body & Headings**: Clean modern sans-serif (Inter, system UI fallback) with tight tracking on headings.
- **Metadata & Data Labels**: Monospace font (JetBrains Mono, ui-monospace) for durations, resolutions (1080x1920), frame rates (30fps), and prices (₹14,500).

---

## 3. Interaction & UX Principles

### A. Progressive Disclosure & Immediate Feedback
- New users with zero previous works see an uncluttered, functional Studio Launcher Canvas with an inline project name prompt, rather than empty dead space or intrusive marketing carousels.
- Actions (playing videos, muting audio, switching between grid/list view, downloading MP4) must respond with zero perceptible delay.

### B. In-Context Media Controls
- Video cards must support direct in-card 9:16 vertical playback with hover or single-click, direct audio toggle, and direct MP4 export.
- Lightbox cinema mode must provide full timeline scrubbing, speed control, and native mobile share triggers (
avigator.share).

### C. Cost & Privacy Transparency
- Clearly communicate client-side storage privacy: projects remain locally cached on the user device ( cloud cost), and exported videos save directly to user files.
