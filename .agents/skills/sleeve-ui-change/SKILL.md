---
name: sleeve-ui-change
description: Use when building or changing Sleeve pages, dialogs, cards, filters, forms, navigation or empty/loading/error states. Enforces the vinyl-lounge design tokens, CoverArt, React Query patterns and accessibility rules.
---

# Sleeve UI change

Read `docs/DESIGN_SYSTEM.md` for the section you are touching before editing.

## Tokens and classes

- Theme tokens live in `src/index.css`. Reuse `accent`, `cream`, `muted`, `ink-950` and the existing surface classes.
- Component classes: `.panel`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.chip`, `.chip-active`, `.eyebrow`.
- Use `cn()` from `src/lib/utils.ts` for conditional classes. Do not add a new palette or hardcode hex colors.
- Icons come from `lucide-react`. Every icon-only button needs `aria-label`.

## Data

- Server state uses `useQuery` / `useMutation` from `@tanstack/react-query`.
- Fetch through `api.*` from `src/lib/api.ts`; never call `fetch` in a component.
- Use a stable query key that includes the filters.
- After a mutation, invalidate every affected key; show success and error with `useToast`.
- Prices enter forms as text and pass through `parsePriceInput`.

## Covers

Use `CoverArt` for every cover. It proxies the Cover Art Archive through `/api/cover` and handles fallbacks. Do not render a raw CAA URL in an `<img>`.

## Dialogs

Follow the existing dialog shape in `src/components/wishlist-edit-dialog.tsx`:

- Controlled by an `item | null` or equivalent prop plus `onClose`.
- `role="dialog"` and `aria-modal="true"` on the panel.
- Escape closes; body `overflow` is locked while open.
- Overlay is `fixed inset-0 z-[60]` with blurred backdrop; panel uses `.panel`.
- Close button is `icon-btn` with `aria-label="Close"`.
- Reset local form state in an effect when the edited item changes.

## Pages and navigation

- Index headers follow `docs/DESIGN_SYSTEM.md` § Page headers and actions: eyebrow, display title, one description line, one accent action.
- Register routes in `src/App.tsx`; heavy pages stay lazy.
- Add a page to `src/components/sidebar.tsx` and `mobile-nav.tsx` only when it is a primary destination.
- Mobile nav has 4 destinations plus the center add button; settings stays in the header.

## States

- Loading: skeletons or existing spinners, not blank screens.
- Empty: `EmptyState` with one clear action.
- Error: keep the surrounding layout and show a retry action.
- Never silently swallow an `ApiError`; surface its message.

## Responsive check

Test desktop and mobile widths. Check the mobile nav, dialog height, long titles and table/card overflow. Use the existing `sm:` / `lg:` breakpoints.

## Verify

Run `sleeve-verify`. Then test the touched flow at desktop and mobile widths.
