# Design system

Canonical reference for Sleeve’s visual language, tokens and UI patterns. Read this before adding pages, components or dialogs. Theme source of truth: `src/index.css`; accent presets: `src/lib/settings.tsx`.

## Identity

**Direction:** dark “vinyl lounge” — warm analog accents, editorial typography, album art as the hero, Spotify-like navigation and density.

- Dark only. There is no light theme.
- Warm amber by default, with user-selectable accents.
- Surfaces are near-black with subtle white borders, not pure black.
- Covers are square, prominent and use fallback art when CAA fails.
- Filled primary actions use the accent; everything else is quiet glass/secondary.
- Rounded, pill-heavy language for controls; rounded cards for surfaces.

## Color tokens

Defined as Tailwind v4 theme variables in `src/index.css`.

| Token | Hex | Utility | Use |
| --- | --- | --- | --- |
| `ink-950` | `#07080b` | `bg-ink-950` | Page background |
| `ink-900` | `#0b0d11` | `bg-ink-900` | Panels, dialogs |
| `ink-850` | `#0e1116` | `bg-ink-850` | Deep surfaces |
| `ink-800` | `#12151c` | `bg-ink-800` | Raised surfaces |
| `ink-700` | `#1a1f29` | `bg-ink-700` | Controls/borders |
| `ink-600` | `#252c3a` | `bg-ink-600` | Strong controls |
| `cream` | `#f3efe6` | `text-cream` | Primary text |
| `muted` | `#98a0ad` | `text-muted` | Secondary text |
| `accent` | `#f4b860` | `bg-accent` / `text-accent` | Primary accent |
| `accent-soft` | `#ffd9a0` | `text-accent-soft` | Primary hover |
| `coral` | `#ef7d5b` | `bg-coral` / `text-coral` | Secondary/warning accent |

Common transparent treatments:

- Borders: `border-white/10`, `border-white/[0.07]`, `border-white/[0.06]`.
- Muted surfaces: `bg-white/[0.02]`, `bg-white/[0.04]`.
- Hover: `border-white/20`, `bg-white/[0.08]`.
- Disabled: `disabled:opacity-50` / `disabled:pointer-events-none`.

### Accent presets

Applied at runtime by setting `--color-accent` and `--color-accent-soft` on `document.documentElement`.

| Key | Label | Accent | Soft |
| --- | --- | --- | --- |
| `amber` | Amber | `#f4b860` | `#ffd9a0` |
| `coral` | Coral | `#ef7d5b` | `#ffb8a3` |
| `moss` | Moss | `#b9d97c` | `#daf0ac` |
| `sky` | Sky | `#7fb8f5` | `#b9d9fb` |
| `lilac` | Lilac | `#c6a5ff` | `#e2d1ff` |

Accent glows:

- `.accent-glow` — logo/compact glow.
- `.accent-glow-strong` — floating mobile Add button.
- `.btn-primary` has an accent-tinted shadow.

Do not hardcode amber in new components; use `accent`/`accent-soft` or CSS variables.

### Semantic badge colors

**Formats**

| Format | Badge |
| --- | --- |
| CD | accent |
| Vinyl | coral |
| Cassette | sky |
| Digital | violet |
| Other | neutral white |

`FormatBadge` lives in `src/components/release-card.tsx`.

**Wishlist priority**

| Priority | Color |
| --- | --- |
| Low (1) | neutral |
| Medium (2) | accent |
| High (3) | coral |

**Artist release-group types**

| Type | Color |
| --- | --- |
| Album | accent |
| EP | sky |
| Single | neutral |
| Other | muted |

**Data-viz format colors**

CD `var(--color-accent)`, Vinyl `var(--color-coral)`, Cassette `#7fb8f5`, Digital `#c6a5ff`, Other `rgba(255,255,255,0.35)`.

## Typography

- Body: **Inter**, fallback system sans.
- Display/headings: **Space Grotesk**, fallback Inter/system.
- Fonts load from Google Fonts. Offline falls back to system fonts.
- Numeric stats use tabular numbers (`tabular-nums`).
- The UI copy is English, sentence case.

Typical scale:

| Role | Treatment |
| --- | --- |
| Page title | `font-display text-4xl md:text-5xl font-semibold tracking-tight` |
| Section title | `font-display text-2xl font-semibold` |
| Panel title | `font-display text-base font-semibold` |
| Body | `text-sm` |
| Metadata | `text-[10px]`/`text-[11px]`, `text-muted/60` |
| Eyebrow | `.eyebrow` — 10px, uppercase, `tracking-[0.24em]`, accent/80 |
| Field label | `.field-label` — 10px, uppercase, `tracking-[0.16em]`, muted |

Do not introduce another display font or all-caps body copy.

## Layout

### Desktop shell

- Fixed sidebar: `264px` (`lg:pl-[264px]`).
- Sticky header with backdrop blur.
- Main max width: `1500px`; page padding `px-4 lg:px-10`.
- Page bottom padding protects the mobile nav: `pb-24`/`pb-28`.

### Sidebar

- Logo at top.
- Nav: Library, Discover, Wishlist, Insights, Settings.
- Active: `bg-white/[0.07] text-cream`, accent icon.
- “On the shelf” mini counts.
- Bottom “Grow the collection” CTA.

### Mobile

- Sidebar hidden below `lg`.
- Bottom nav: 5 items — Library, Discover, Add (floating accent), Wishlist, Insights.
- Settings is reachable from the mobile header gear.
- Filters wrap; grids go 2 columns.
- Dialogs become bottom sheets (`rounded-t-3xl`, full width) and switch to centered cards at `sm`.
- Full-height fixed elements respect `pb-[env(safe-area-inset-bottom)]`.

## Surfaces, radius and shadows

- Panels: `.panel` — `rounded-2xl border border-white/10 bg-ink-900/60`.
- Cards: `rounded-xl`; covers are borderless.
- Empty panels: `rounded-2xl`.
- Inputs: `rounded-xl`.
- Buttons/chips/selects: pill (`rounded-full`).
- Dialogs: `rounded-t-3xl` mobile, `sm:rounded-3xl`.
- Hover cards: lift `-translate-y-1`, cover scales `1.05`.
- Avoid bright white surfaces and heavy inner glows.

## Background

- Base: `bg-ink-950`.
- Fixed radial accent wash top-right.
- Fixed coral wash top-left.
- 3% fractal-noise overlay via `body::before`.
- Do not add additional page-wide gradients.

## Page headers and actions

Index pages — Library, Discover, Wishlist, Insights, Settings — use a plain header:

1. Eyebrow with section icon.
2. Display title.
3. One short description line.
4. Primary action left-aligned directly below the description, using `.btn-primary` (accent fill).

Rules:

- Do not wrap index headers in gradient boxes, rounded cards or decorative vinyl backdrops.
- Keep one accent-filled action per header. Secondary actions can sit beside it as `.btn-secondary`.
- Supporting stats use the same number-and-label row directly below the actions.
- Detail pages (release, artist) may use a back link above their content panel.
- Do not add page-level back links to primary destinations; sidebar and mobile nav already provide navigation.
- Header actions and filters align consistently across pages: filters left, view controls right.

## Components

These classes live in `src/index.css`.

| Class | Purpose |
| --- | --- |
| `.btn` + `.btn-primary` | Main action; accent fill, dark text |
| `.btn-secondary` | Glass border action |
| `.btn-ghost` | Quiet text action |
| `.btn-danger` | Destructive action |
| `.icon-btn` | 36px round icon action |
| `.input` | Text/select/textarea field |
| `.select` | Compact pill select |
| `.field-label` | Form label |
| `.chip` / `.chip-active` | Filter/status pill |
| `.panel` | Standard surface |
| `.eyebrow` | Section kicker |
| `.divider` | 1px hairline |
| `.skeleton` | Shimmer placeholder |

### Buttons

- Primary: accent + ink text, rounded-full, `py-2.5`.
- Secondary: transparent glass with border.
- Ghost: text-only, muted until hover.
- Danger: red tint, never used for normal delete dialogs without confirmation.
- Compact buttons use `py-2 text-xs`.
- Icon-only controls must use `.icon-btn` plus `aria-label`.

### Forms

- Labels use `.field-label`.
- Inputs use `.input`; focus: accent border + 2px accent ring.
- Selects are pill-shaped in filters and standard inputs in forms.
- Price fields are `type="text"` with `inputMode="decimal"`; parser accepts comma/dot.
- Rating uses five star buttons, accent for filled.
- Validation errors are inline red/coral text; server errors surface via toast.
- No placeholder-only labels.

### Chips and filters

- Inactive: quiet border, muted text.
- Active: accent border/background/text.
- Chips are not buttons for destructive actions.
- Filter state lives in URL params on the Library page.

### Cover art

- Always use `CoverArt`; never raw `<img>` for CAA URLs.
- `CoverArt` rewrites CAA URLs to `/api/cover` for disk/browser caching.
- Covers are borderless. Do not add colored, white or hover borders around cover art.
- Loading/failure fallback: hue-derived dark gradient + `Disc3` + truncated title in small uppercase.
- Hover: image scale, dark gradient overlay, accent circular action.
- Use lazy loading; do not render huge raw covers in lists.
- CAA 404 is common; show fallback and a **Search match** path on release pages.

### Release cards and rows

- Grid cards: square cover, format badge top-left, hover action bottom-right, title/artist/year below.
- List rows: 48px cover, title/artist, year, format badge, rating, added date, chevron.
- Cards click through to `/releases/:id`; do not nest links inside card buttons.
- Artist/wishlist/discover cards reuse the same square-cover rhythm.

### Dialogs

Examples: Add release, wishlist add/edit, metadata enrich/match.

- Fixed overlay `bg-black/75 backdrop-blur-sm`.
- `role="dialog"`, `aria-modal="true"`, descriptive `aria-label`.
- Header: title, subtitle, close icon.
- Body scrolls independently; footer holds actions.
- Lock body scroll; close on Escape when safe.
- Mobile bottom-sheet, desktop centered.
- Width classes: standard form `max-w-lg`, search `max-w-2xl`, add release `max-w-5xl`.
- Do not nest dialogs.
- Confirmation for destructive actions is inline, two-step.

### Toasts

- Fixed bottom-right desktop, above mobile nav on small screens.
- Success/error/info icon.
- Auto-dismiss; manual close.
- Use for async results and failures; do not use alerts.

### Empty/loading/error states

- Every data view has all three.
- Empty: concentric vinyl illustration + title + description + primary action.
- Loading: skeletons matching final layout, not spinners alone.
- Error: short cause + retry; never expose raw stack traces.
- Inline warnings use `border-coral/20 bg-coral/[0.06]`.

### Stats and data viz

- KPI cards: icon circle, uppercase hint, large display number, muted label.
- Horizontal bars: 2px/8px height, faint track, accent/coral fills.
- Monthly chart: 12 bars, accent gradient, min-height for zero values.
- Donut: `conic-gradient` with format colors; inner dark circle.
- Ranked lists: subtle accent background proportional to value.
- Keep charts decorative but accurate; no chart library currently.

### Navigation and metadata

- Icons: Lucide, stroke-based, 11–22px.
- Active nav uses accent icon, not accent background.
- Artist links in release/discover pages use quiet hover-to-cream text.
- Page eyebrows identify the section. Use back links on detail pages only; primary destinations rely on the sidebar and mobile nav.

## Motion

- Standard interaction duration: 200ms.
- Hover covers/cards: 300–500ms.
- Page/dialog entry: `animate-scale-in` 240ms, fade 200ms.
- Drawer slide: `animate-slide-in` 260ms (kept for future panels).
- Slow vinyl spin: 26s.
- Skeleton shimmer: 1.6s.
- No confetti, bouncing or attention-seeking loops.

## Accessibility

Current requirements:

- Icon-only buttons have `aria-label`.
- Dialogs use `role="dialog"` and `aria-modal`.
- Cards/buttons are real `<button>`/`<a>` elements.
- Visible focus for inputs and card-like controls.
- Color is never the only signal: labels accompany format/priority badges.
- Images have `alt` or an accessible container label.
- Keyboard: Escape closes dialogs; forms are keyboard reachable.

Known gaps to improve:

- Dialogs do not yet implement a full focus trap or restore focus.
- Toasts lack an explicit live region.
- `prefers-reduced-motion` is not handled.
- Some hover-only affordances rely on pointer hover; inline alternatives exist for critical actions.
- Contrast should be spot-checked when adding new muted text on dark surfaces.

## Content rules

- Concise, human, record-shop tone.
- Sentence case for descriptions; uppercase only for eyebrows/labels/badges.
- Numbers use locale formatting; prices use the stored currency.
- Dates use locale display; date-only values are formatted in UTC.
- No emojis in product UI unless explicitly requested.
- Avoid technical jargon in user-facing copy.

## Do / don’t

**Do**

- Use `panel`, `btn`, `input`, `chip`, `eyebrow`.
- Use album art as the dominant visual element.
- Use accent sparingly for action and emphasis.
- Use `CoverArt` and the cover proxy.
- Add loading, empty and error states.
- Check mobile and desktop.
- Keep one primary action per region.
- Put the primary page action on the left, accent-filled, below the header description.
- Keep covers borderless.

**Don’t**

- Introduce a new palette or font.
- Hardcode `#f4b860` in components.
- Use raw CAA image URLs.
- Add borders around cover art.
- Wrap index page headers in gradient boxes or vinyl decorations.
- Nest buttons/links inside card buttons.
- Add autoplay/audio affordances before playback exists.
- Add comments or decorative animation that does not clarify state.
- Use square buttons or heavy borders.

## Adding new UI

### New page

1. Create `src/pages/<page>.tsx`.
2. Reuse the plain page header pattern: eyebrow, display title, description and a left-aligned accent primary action. Add a back link only on detail pages.
3. Use `panel`, `chip`, `btn` rather than new primitives.
4. Register the route in `src/App.tsx`.
5. Add nav entry only if it is a primary destination.
6. Lazy-load heavy tools (see `/import/csv`).
7. Check mobile + desktop.

### New dialog

1. Copy the overlay/panel/header/footer pattern from an existing dialog.
2. Add `role="dialog"`, `aria-modal`, `aria-label`.
3. Lock body scroll; close on Escape.
4. Provide loading/disabled/error states.
5. Use max width based on complexity: `lg` form, `2xl` search, `5xl` full add flow.
6. Do not nest dialogs.

### New card

- Square cover + `CoverArt` + format badge.
- Hover lift and overlay action.
- Title, artist, then 10–11px metadata.
- Use one action: open details/apply/add. For multiple actions, separate sibling controls, not nested buttons.

## File map

- Tokens/components/animations: `src/index.css`
- Accent presets and settings: `src/lib/settings.tsx`
- Cover proxy rendering: `src/components/cover-art.tsx`
- Format badge/rating/cards: `src/components/release-card.tsx`
- Shell/navigation: `src/components/sidebar.tsx`, `header.tsx`, `mobile-nav.tsx`
- Dialogs: `src/components/*dialog*.tsx`
- Empty/skeleton patterns: `src/components/empty-state.tsx`, page-level skeletons
- Toasts/offline: `src/components/toast.tsx`, `offline-banner.tsx`
