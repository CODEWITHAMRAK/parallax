---
name: Lumina Assist
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#40484b'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#70787c'
  outline-variant: '#c0c8cb'
  surface-tint: '#306576'
  primary: '#003441'
  on-primary: '#ffffff'
  primary-container: '#0f4c5c'
  on-primary-container: '#87bbce'
  inverse-primary: '#9acee1'
  secondary: '#605e55'
  on-secondary: '#ffffff'
  secondary-container: '#e6e2d6'
  on-secondary-container: '#66645b'
  tertiary: '#2f302d'
  on-tertiary: '#ffffff'
  tertiary-container: '#464643'
  on-tertiary-container: '#b5b4af'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b6ebfe'
  primary-fixed-dim: '#9acee1'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#114d5d'
  secondary-fixed: '#e6e2d6'
  secondary-fixed-dim: '#cac6bb'
  on-secondary-fixed: '#1d1c15'
  on-secondary-fixed-variant: '#48473e'
  tertiary-fixed: '#e4e2dd'
  tertiary-fixed-dim: '#c8c6c2'
  on-tertiary-fixed: '#1b1c19'
  on-tertiary-fixed-variant: '#474744'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  kannada-body:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.8'
  hindi-body:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.8'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  touch-target-min: 48px
  container-max: 800px
  gutter: 24px
  margin-mobile: 20px
  stack-lg: 40px
---

## Brand & Style

The design system is rooted in the philosophy of "Invisible Assistance"—technology that recedes into the background to prioritize human agency. The personality is calm, supportive, and fundamentally inclusive. It avoids the cold, clinical aesthetic of traditional enterprise software in favor of a warm, domestic premium feel.

The design style combines **Soft Minimalism** with **Tactile Functionalism**. It leverages heavy whitespace to reduce cognitive load and uses high-contrast typography to ensure clarity for users with varying visual abilities. The interface should feel like a well-lit, open space where every element is easy to find and interact with.

**Key Principles:**
- **Clarity over Density:** Never crowd the interface; if a task is complex, break it into progressive steps.
- **Intentional Friction:** Use clear confirmations for destructive actions, but keep supportive paths frictionless.
- **Human Warmth:** Use soft curves and warm neutrals to avoid a "technical" or "government" feel.

## Colors

The palette is designed for maximum visual comfort and WCAG AAA compliance for text elements.

- **Primary (Deep Teal):** Used for primary actions, focus indicators, and brand presence. It provides a strong anchor against the light background.
- **Secondary/Tertiary (Cream & Off-White):** These form the "canvas." By using a warm off-white (#F7F5F0) instead of pure white, we reduce screen glare which helps users with light sensitivity or dyslexia.
- **Neutral (Charcoal):** Used for all body text and iconography to ensure a contrast ratio of at least 7:1 against the background.
- **Semantic Colors:** Use a muted Sage for success, a soft Terracotta for errors, and an Ochre for warnings, ensuring they are always accompanied by icons or text labels to assist color-blind users.

## Typography

This design system uses **Atkinson Hyperlegible Next** as its primary typeface. This font was specifically designed to increase character recognition and improve legibility for users with low vision. 

**Implementation Notes:**
- **Language Support:** For Kannada and Hindi, fallback to **Noto Sans**, ensuring font size is increased by 10-15% to maintain equivalent x-height legibility compared to Latin script.
- **Hierarchy:** Use "Display" styles sparingly for welcome screens or section headers. "Body-lg" is the default for all conversational text and instructions.
- **Line Height:** Tightening line heights is forbidden; keep a minimum of 1.5x for body text to prevent "crowding" of descenders and ascenders.

## Layout & Spacing

The layout follows a **Fixed-Centered** approach for desktop to prevent long line lengths that are difficult to read, and a **Fluid-Safe** approach for mobile.

- **The 8px Grid:** All spacing must be a multiple of 8px. 
- **Touch Targets:** No interactive element (button, link, checkbox) should be smaller than 48x48px to accommodate users with limited motor precision.
- **Content Width:** Body text containers should never exceed 800px in width to maintain an ideal reading rhythm (approx. 70-80 characters per line).
- **Safe Zones:** Use generous 40px (stack-lg) vertical spacing between distinct content blocks to allow the eye to rest and differentiate sections easily.

## Elevation & Depth

To maintain a "Calm & Trustworthy" feel, this design system avoids heavy drop shadows and complex 3D effects. Depth is communicated through **Tonal Layering** and **Soft Plinth** shadows.

- **Level 0 (Base):** The primary background color (#F7F5F0).
- **Level 1 (Cards/Containers):** Pure white surfaces with a very subtle, diffused shadow (15% opacity primary color, 20px blur, 4px offset). This makes the element look "lifted" but not detached.
- **Focus State:** Interactive elements use a 4px solid Primary Teal border when focused, ensuring a clear visual indicator for keyboard and screen-reader navigation.
- **Overlays:** Use a 40% opacity charcoal scrim for modals to pull focus to the foreground task.

## Shapes

The shape language is "Soft-Organic." We use a consistent corner radius of **0.5rem (8px)** for standard components and **1rem (16px)** for large containers/cards.

- **Interactive Elements:** Buttons and input fields use `rounded-lg` (16px) to feel approachable and "squishy" without being fully circular (which can sometimes be mistaken for decorative pills).
- **Selection States:** Use a thick inner stroke or a filled state to show selection, rather than just a color change.

## Components

### Buttons
- **Primary:** Filled Primary Teal with white text. Minimum height 56px for high visibility and ease of tapping.
- **Secondary:** Outlined (2px Primary Teal) with Teal text.
- **Labels:** Always use semi-bold weight for button labels.

### Input Fields
- **Design:** Large 64px height fields with a light-grey fill (#E9E5D9) and a 2px bottom-border that transforms into a full 2px stroke on focus.
- **Labels:** Labels must always be visible (never use placeholder text as the only label).

### Cards
- **Structure:** Use for grouping related information (e.g., service options). Cards should have a 24px internal padding.
- **Interactivity:** If a card is clickable, the entire surface area must act as the trigger, with a subtle lift effect on hover.

### Listening/Feedback States
- **Visuals:** For voice-assisted features, use a slow, rhythmic "pulse" animation of the primary color—resembling a calm breath—rather than a rapid spinning loader.
- **Status Chips:** Use large chips (40px height) with icons to indicate current system status (e.g., "Active," "Completed," "Processing").

### Navigation
- **Simple Steppers:** For multi-step processes, use a "Step X of Y" text indicator instead of complex progress bars with small icons.
- **Back Buttons:** Always present in the top-left corner, clearly labeled with the word "Back" alongside an arrow icon.