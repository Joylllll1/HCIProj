# DESIGN.md

## Overview
A hybrid design system combining:
- Apple-style visual polish and spacious layouts
- Notion-style productivity and modular structure

Designed for:
- AI apps
- Community platforms (e.g. Treehole)
- SaaS dashboards + marketing pages

---

## 01. Colors

### Core
- `color.bg.primary`: #ffffff
- `color.bg.alt`: #f5f5f7
- `color.text.primary`: rgba(0,0,0,0.9)
- `color.text.secondary`: rgba(0,0,0,0.6)

### Brand
- `color.brand.blue`: #0071e3
- `color.brand.blue.soft`: #0075de

### Interactive
- `color.blue.hover`: #005bab
- `color.blue.focus`: #097fe8

### Dark Mode / Cards
- `color.dark.surface.1`: #1d1d1f
- `color.dark.surface.2`: #272729

### Warm System (Notion-style)
- `color.bg.warm`: #f6f5f4
- `color.text.muted`: #a39e98

### Semantic
- `color.success`: #1aae39
- `color.info`: #2a9d99
- `color.warning`: #dd5b00
- `color.accent.pink`: #ff64c8
- `color.accent.purple`: #391c57

---

## 02. Typography

### Font Family
- Primary: Inter / SF Pro Display fallback

---

### Display (Apple-style)
- `display.hero`: 56–64px / 700 / tight tracking
- `display.section`: 40–48px / 600–700

### Structure (Notion-style)
- `heading.sub`: 24–28px / 600–700
- `card.title`: 20–22px / 600–700

### Body
- `body.large`: 18–20px / 500
- `body.default`: 16–17px / 400
- `body.meta`: 14px / 400–500

### Micro
- `text.caption`: 12–13px
- `text.badge`: 12px / 600

---

## 03. Buttons

### Primary (Apple style)
- Background: `color.brand.blue`
- Text: white
- Radius: pill (9999px)
- Usage: main CTA

### Secondary (Notion style)
- Background: transparent
- Border: subtle gray
- Radius: 6–8px

### Ghost
- No border
- Text: blue

### Badge / Pill
- Small rounded labels
- Used for tags, status

---

### States
- Hover: darker blue
- Active: `color.blue.hover`
- Focus: 2px ring `color.blue.focus`

---

## 04. Cards

### Light Cards (Notion)
- Background: white
- Radius: 12px
- Border: subtle
- Layout: vertical

### Dark Cards (Apple)
- Background: `color.dark.surface.1`
- Text: white
- Used in hero sections

---

### Structure
- Tag / category (optional)
- Title
- Description
- CTA or interaction

---

## 05. Forms

### Inputs
- Background: white
- Border: light gray
- Radius: 6px

### States
- Focus → blue ring
- Error → orange
- Disabled → muted gray

---

## 06. Spacing

Scale:
`4, 8, 12, 16, 20, 24, 32`

Usage:
- Compact UI: 8–12
- Cards: 16–24
- Sections: 24–32+

---

## 07. Radius

- `radius.sm`: 6px
- `radius.md`: 10–12px
- `radius.lg`: 16px
- `radius.pill`: 9999px

---

## 08. Elevation

### Levels
- Flat: no shadow
- Card: soft shadow (low opacity)
- Floating: stronger blur shadow

### Special
- Glass nav (Apple style)
  - backdrop blur
  - semi-transparent

---

## Design Principles

1. Use whitespace like Apple
2. Structure content like Notion
3. Use color sparingly (only for action + meaning)
4. Keep UI modular and scalable
5. Prioritize readability over decoration

---

## Component Guidelines

### Layout
- Marketing sections: centered (Apple)
- Product UI: left-aligned (Notion)
- Grid-based system

---

### Interaction
- Minimal animation (150–250ms)
- Smooth hover + focus
- No flashy transitions

---

### Content Tone
- Clear
- Slightly emotional (Treehole context)
- Minimal but expressive

---

## Treehole-Specific Extensions

### Post Card
- Anonymous avatar
- Content text (multi-line)
- Meta (time, likes, comments)
- Optional tag (emotion/category)

### Emotion Tags
- Calm → teal
- Happy → green
- Anxious → orange
- Sad → purple/pink

---

## Usage Instruction (for AI)

When generating UI:

### For Landing Page
- Use large hero text
- Add dark/light contrast sections
- Use big spacing and minimal text

### For App UI
- Use card-based layout
- Left-aligned content
- Modular blocks (like Notion)

### Always
- Use blue as primary action color
- Avoid visual clutter
- Prefer typography over decoration
- Keep layouts clean and structured

