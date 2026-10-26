# Institutional About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/nosotros` into a premium institutional editorial page using verified Banco GNB Perú facts, responsive imagery, accessible motion, and tested CTAs.

**Architecture:** Replace only `AboutPage` with a full-width semantic composition using existing `ResponsiveImage`, `Reveal`, and `ButtonLink` primitives. Add isolated `about-*` styles, two generated source images plus responsive WebP variants, and one E2E scenario that proves structure, image loading, overflow safety, and CTA navigation.

**Tech Stack:** React 19, TypeScript, Vite, Motion/Reveal, plain CSS tokens, Sharp, Playwright.

## Global Constraints

- Modify only `/nosotros`, its isolated `about-*` styles, its E2E coverage, image build inputs, generated image assets, and directly related documentation.
- Do not modify the backend, Landing, Login, Dashboard, existing routes, or shared behavior.
- Use only facts verified at <https://www.bancognb.com.pe/inicio/banco-gnb-peru/quienes-somos>.
- Do not invent figures, products, awards, certifications, directors, agency locations, leadership claims, mission, or vision.
- Reuse `landing-hero`, `human-support`, and `service-architecture`.
- Generate exactly two new images: `personal-banking` and `business-banking`.
- Prefix every new page-specific class with `about-`.
- Validate 1440×900, 1024×768, and 390×844.
- Preserve `prefers-reduced-motion` behavior.

---

### Task 1: Add the failing institutional E2E contract

**Files:**
- Modify: `tests/e2e/portal.spec.ts`

**Interfaces:**
- Consumes: public route `/nosotros` and existing header navigation.
- Produces: an E2E contract for section headings, five responsive images, CTA destinations, and horizontal fit.

- [ ] **Step 1: Add the failing test**

Add a test named `nosotros presenta la historia institucional y sus canales de atención` that visits `/nosotros`, asserts the H1 `Una historia de confianza que sigue avanzando`, verifies the headings `Quiénes somos`, `Presencia que conecta`, `Banca Personal`, `Banca Empresarial`, `Atención humana y calificada`, and `Juntos llegamos más lejos`, checks five images have non-zero `naturalWidth`, checks `scrollWidth <= clientWidth + 1`, and clicks CTA links to `/registro` and `/preguntas-frecuentes` using browser history to return between checks.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npx playwright test tests/e2e/portal.spec.ts --project=desktop --grep "nosotros presenta"
```

Expected: FAIL because the new H1 and institutional sections do not exist.

---

### Task 2: Generate and optimize the two approved editorial images

**Files:**
- Create: `src/assets/images/source/personal-banking.png`
- Create: `src/assets/images/source/business-banking.png`
- Modify: `scripts/build-images.mjs`
- Create: `src/assets/images/web/personal-banking-{desktop,tablet,mobile}.webp`
- Create: `src/assets/images/web/business-banking-{desktop,tablet,mobile}.webp`
- Modify: `docs/image-manifest.md`

**Interfaces:**
- Consumes: `ResponsiveImage` naming convention `<name>-<size>.webp`.
- Produces: `ResponsiveImage name="personal-banking"` and `ResponsiveImage name="business-banking"`.

- [ ] **Step 1: Generate `personal-banking` with built-in image generation**

Prompt for an editorial photorealistic scene of a financial adviser and an adult client in a reserved contemporary banking environment, natural window light, navy tailoring, pale stone, subtle brass and warm wood, candid consultation around a tablet, no logos, no text, no watermark, no recognizable real person, wide landscape composition with safe crops for portrait variants.

- [ ] **Step 2: Generate `business-banking` with built-in image generation**

Prompt for an editorial photorealistic scene of a small diverse professional team collaborating around documents and a laptop in an elegant financial meeting room, natural daylight, navy, muted blue, pale stone, wood and restrained brass, no logos, no text, no watermark, no recognizable real person, wide landscape composition with safe crops for portrait variants.

- [ ] **Step 3: Inspect both outputs and copy accepted originals into the project**

Validate subject, hands, tablet/laptop geometry, lighting, palette, absence of text/logos/watermarks, and crop safety. Save accepted files under the exact source paths above.

- [ ] **Step 4: Extend the image build list and create responsive WebP files**

Add:

```js
{ name: "personal-banking", position: "centre" },
{ name: "business-banking", position: "centre" },
```

Run:

```powershell
npm run assets:build
```

Expected: six new WebP files at 1920×1080, 1280×1024, and 780×1040.

- [ ] **Step 5: Update the image manifest**

Document both asset purposes, Spanish alt text, and the three generated dimensions. Do not change existing entries.

---

### Task 3: Implement the semantic institutional page

**Files:**
- Modify: `src/pages/public-pages.tsx`

**Interfaces:**
- Consumes: `ButtonLink`, `ResponsiveImage`, `Reveal`.
- Produces: `AboutPage(): JSX.Element` with only `about-*` page-specific classes.

- [ ] **Step 1: Replace only `AboutPage`**

Build a top-level `<div className="about-page">` containing:

```tsx
<section className="about-hero">...</section>
<Reveal className="about-intro">...</Reveal>
<Reveal className="about-history">...</Reveal>
<Reveal className="about-presence">...</Reveal>
<section className="about-segments">...</section>
<Reveal className="about-service">...</Reveal>
<Reveal className="about-closing">...</Reveal>
```

Use one H1, sequential H2/H3 headings, semantic lists for the four milestones, and verified paraphrased copy only. CTA labels and targets:

```tsx
<ButtonLink to="/registro">Crear una solicitud</ButtonLink>
<ButtonLink to="/preguntas-frecuentes" variant="secondary">
  Ir a preguntas frecuentes
</ButtonLink>
```

- [ ] **Step 2: Wire the approved images with Spanish alt text**

```tsx
<ResponsiveImage name="landing-hero" alt="Atrio contemporáneo que representa la presencia institucional de Banco GNB Perú" />
<ResponsiveImage name="service-architecture" alt="Arquitectura azul y dorada conectada por un recorrido continuo" />
<ResponsiveImage name="personal-banking" alt="Asesor y cliente conversando en un entorno financiero reservado" />
<ResponsiveImage name="business-banking" alt="Profesionales colaborando en una reunión de trabajo" />
<ResponsiveImage name="human-support" alt="Asesor orientando personalmente a una cliente" />
```

- [ ] **Step 3: Confirm forbidden claims are absent**

Search `AboutPage` for unverified agency cities, products, awards, certifications, leadership claims, mission, and vision. Expected: no matches.

---

### Task 4: Add isolated premium responsive styling

**Files:**
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: existing CSS variables from `tokens.css`.
- Produces: isolated `about-*` layouts for desktop, tablet, mobile, focus, hover, and reduced motion.

- [ ] **Step 1: Add base editorial styles**

Create styles for hero split composition, large editorial typography, gold rules, narrative history line, national-presence split, image-led segment diptych, human-service section, and navy closing section. Use `clamp()` for typography and spacing; avoid generic card shadows on milestone items.

- [ ] **Step 2: Add tablet rules under `@media (max-width: 1100px)`**

Collapse dense four-column history into two columns, preserve two-column narrative blocks where readable, and keep image crops intentional.

- [ ] **Step 3: Add mobile rules under `@media (max-width: 760px)`**

Convert every `about-*` grid to one column, keep CTAs at least 44 px tall, make action groups full width, constrain image heights, and remove transforms that could create horizontal overflow.

- [ ] **Step 4: Add page-specific reduced-motion safety**

Rely on the global `prefers-reduced-motion` rule and ensure no `about-*` transition carries essential meaning.

- [ ] **Step 5: Run focused E2E and confirm GREEN**

Run:

```powershell
npx playwright test tests/e2e/portal.spec.ts --project=desktop --grep "nosotros presenta"
```

Expected: PASS.

---

### Task 5: Verify, visually QA, capture, and document

**Files:**
- Modify: `artifacts/screenshots/desktop-1440/nosotros.png`
- Modify: `artifacts/screenshots/tablet-1024/nosotros.png`
- Modify: `artifacts/screenshots/mobile-390/nosotros.png`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: final page and existing screenshot conventions.
- Produces: verified test evidence, responsive captures, and accurate documentation.

- [ ] **Step 1: Run required verification in order**

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: all commands exit 0; report exact test counts and any deliberate skips.

- [ ] **Step 2: Perform functional QA**

At desktop and mobile, activate both page CTAs through normal browser input, verify destinations, return via history, inspect keyboard focus, and confirm all five images load.

- [ ] **Step 3: Perform separate visual QA**

Inspect 1440×900, 1024×768, and 390×844 for hierarchy, crop quality, contrast, section rhythm, visible focus, touch targets, text clipping, and horizontal overflow. Exploratory checks: longest headings at 390 px and page behavior with reduced motion enabled.

- [ ] **Step 4: Regenerate only `/nosotros` captures**

Use the existing Playwright viewport/capture conventions and write full-page PNG files to the three exact artifact paths above. Confirm output widths are 1440, 1024, and 390 pixels.

- [ ] **Step 5: Update testing documentation with observed results only**

Record exact Vitest/E2E counts, successful verification commands, the `/nosotros` scenario, and the three regenerated captures. Do not change unrelated documentation claims.

- [ ] **Step 6: Final scope audit**

List changed files, confirm no backend or unrelated page files changed, verify there are no temporary scripts, and report any factual or visual gap honestly.
