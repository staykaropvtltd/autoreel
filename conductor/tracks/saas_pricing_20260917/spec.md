# Track Specification: SaaS Pricing Section Integration

**Track ID:** `saas_pricing_20260917`  
**Track Type:** Feature  
**Target File(s):** `frontend/src/components/landing/PricingSection.tsx`, `frontend/src/components/landing/SaaSPricingSection.tsx`

---

## 1. Overview & Goals
Integrate the high-converting modern SaaS Pricing Section inspired by Framer (`https://framer.com/m/SaaS-Pricing-Section-7QyckK.js@3iIeSMaDRp2VjHGNHMA1`) into the Kaladhar Studio landing page (`#pricing`). The component delivers a 3-tier card layout with an interactive monthly/yearly billing toggle, distinct multi-color vibrant jewel tones (Emerald for Starter, Radiant Saffron/Gold glow for Pro, and Royal Violet/Rose for Enterprise), fluid spring hover animations, and complete dark/light theme adaptability.

---

## 2. User Stories & Interaction Flow
1. **Explore Plans**: As a boutique owner or creative director visiting the landing page, I can view three distinct tiers (Starter, Pro, Enterprise) side-by-side on desktop, or stacked on mobile devices.
2. **Toggle Billing Cycles**: As a user comparing options, I can toggle between "Monthly" and "Yearly" billing to view discounted annual pricing ($15/mo for Starter, $39/mo for Pro, vs $19/mo and $49/mo).
3. **Visual Distinction via Jewel Tones**:
   - **Starter**: Clean obsidian/porcelain card with Emerald accent tones (`#10B981`) and animated checks.
   - **Pro (Most Popular)**: High-energy Radiant Saffron / Sunset Gold glowing gradient (`#FF611A` to `#FC731C`), luminous border, and bold CTA.
   - **Enterprise**: Royal Violet / Rose jewel tone (`#8A43E1`, `#EC4899`) conveying scale and premium governance.
4. **Take Action**: Clicking any card's CTA button ("Start free", "Start Pro", "Contact Sales") invokes the studio launcher (`onLaunchStudio`), seamlessly guiding the user into the creative workflow.

---

## 3. Functional Requirements
1. **Tier Content & Exact Copy**:
   - **Starter Card**:
     - Heading: `Starter`
     - Subtitle: `For founders validating a new product motion.`
     - Pricing: `$19` `/mo` (Monthly) | `$15` `/mo` (Yearly)
     - Features:
       - Up to 3 published projects
       - Basic analytics dashboard
       - 10GB asset storage
       - Community support
       - Reusable CMS templates
       - One editor seat included
     - CTA: `Start free`
   - **Pro Card (Featured / Most Popular)**:
     - Heading: `Pro`
     - Subtitle: `For teams shipping campaigns and products faster.`
     - Badge: `MOST POPULAR` (gradient pill)
     - Pricing: `$49` `/mo` (Monthly) | `$39` `/mo` (Yearly)
     - Features:
       - Unlimited published projects
       - Advanced analytics and funnels
       - 100GB asset storage
       - Priority support queue
       - Team libraries and templates
       - Five editor seats included
     - CTA: `Start Pro`
   - **Enterprise Card**:
     - Heading: `Enterprise`
     - Subtitle: `For organizations with governance and scale needs.`
     - Pricing: `Contact Sales`
     - Period: `Custom annual agreement`
     - Features:
       - Unlimited workspaces
       - Dedicated success manager
       - Custom storage limits
       - SAML SSO and audit logs
       - Security review support
       - Unlimited editor seats
     - CTA: `Contact Sales`
2. **Billing Toggle**:
   - Seamless switch between Monthly and Yearly billing cycles.
   - Smooth animated price transition (spring easing).
   - "Save 20%" savings pill indicator.
3. **Multi-Color Vibrant Jewel Tones & Theme Adaptive**:
   - **Dark Mode**: Elevated card surfaces with colored backdrops, glowing borders, jewel-toned checkmark icons, and subtle ambient box shadows.
   - **Light Mode**: Crisp white card surfaces with saturated jewel border accents, warm subtle background gradients, and clear typography.
4. **Interactive Hover Micro-Interactions**:
   - Smooth spring scale (1.025 to 1.035) on card hover with colored border lighting and glow shadows.
   - CTA button hover effects.

---

## 4. Non-Functional Requirements
- **Zero Build Errors**: Passes Vite production build (`npx vite build`).
- **Responsive Design**: Fluid 3-column layout on desktop (>1024px), 2-column or wrapping on tablet, and single-column stack on mobile (<640px).
- **Smooth 60fps Animations**: Uses Framer Motion for hardware-accelerated transforms.

---

## 5. Acceptance Criteria
- [ ] Landing page `#pricing` displays the 3 SaaS pricing cards (Starter, Pro, Enterprise).
- [ ] Monthly / Yearly toggle toggles prices dynamically between $19/$15 and $49/$39.
- [ ] Color styling exhibits distinct jewel tones: Emerald for Starter, Radiant Saffron/Gold for Pro, and Royal Violet/Rose for Enterprise.
- [ ] Both Dark Mode and Light Mode render with impeccable contrast and no visual glitches.
- [ ] All CTA buttons correctly invoke `onLaunchStudio`.
- [ ] Production build succeeds without errors.

---

## 6. Out of Scope
- Backend billing payment processing or Stripe checkout integrations (kept local-first with direct studio access).
