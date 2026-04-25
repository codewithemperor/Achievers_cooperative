# Achievers Cooperative Association — Website

A Next.js 15 website inspired by the Greenleaf Framer template, adapted for Achievers Cooperative Association.

## Tech Stack

- **Next.js 15** (App Router, Static Site Generation)
- **TypeScript**
- **Tailwind CSS v3**
- **HeroUI v2** (component library)
- **Framer Motion** (animations)
- **Lucide React** (icons)
- **react-intersection-observer** (scroll animations)

## Getting Started

### 1. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Build for production (static export)

```bash
npm run build
```

The static files will be output to `./out`.

---

## Project Structure

```
src/
├── app/                     # Next.js App Router pages
│   ├── layout.tsx           # Root layout (Navbar + Footer)
│   ├── page.tsx             # Homepage (SSG)
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── services/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx  # Dynamic SSG service pages
│   ├── news/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx  # Dynamic SSG article pages
│   ├── privacy-policy/page.tsx
│   └── terms/page.tsx
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── sections/            # Homepage section components
│   │   ├── HeroSection.tsx
│   │   ├── AboutSnapshot.tsx
│   │   ├── ServicesSection.tsx
│   │   ├── StatsTicker.tsx
│   │   ├── BenefitsSection.tsx
│   │   ├── TestimonialsSection.tsx
│   │   ├── NewsSection.tsx
│   │   ├── FaqSection.tsx
│   │   └── CtaSection.tsx
│   └── ui/
│       ├── Providers.tsx
│       ├── AnimatedSection.tsx
│       └── ContactForm.tsx
│
└── data/
    └── content.ts           ← ✏️ EDIT ALL SITE CONTENT HERE
```

---

## Editing Content

**All site content lives in one file:** `src/data/content.ts`

Simply open that file and update:
- `siteConfig` — name, tagline, contact details
- `hero` — headline, badge, CTA text
- `services` — service titles and descriptions
- `testimonials` — member quotes
- `newsArticles` — news/blog posts
- `faqs` — FAQ questions and answers
- `aboutPage` — history, mission, vision, team
- `footer` — links and tagline

---

## Fonts

The site uses **Playfair Display** (headings) and **DM Sans** (body) loaded from Google Fonts.

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `coop-dark` | `#1a2e1a` | Primary dark green |
| `coop-green` | `#2d5a27` | Mid green |
| `coop-mid` | `#3d7a35` | Hover green |
| `coop-light` | `#6aab5e` | Accent green |
| `coop-cream` | `#f5f0e8` | Background |
| `coop-sand` | `#e8e0d0` | Secondary bg |

---

## Images

Currently using Unsplash URLs for placeholder images. Replace them by:
1. Placing your images in `public/images/`
2. Updating the `src` props in each component, OR
3. Updating the image paths in `src/data/content.ts` (for avatar/team images)
