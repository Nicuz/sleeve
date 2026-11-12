# Sleeve UI checklist

Use with `sleeve-ui-change`.

## Before editing

- [ ] Read the matching section of `docs/development/design-system.md`.
- [ ] Find an existing page or component with the same shape and copy its structure.
- [ ] Confirm the data already exists in `src/lib/types.ts` and `src/lib/api.ts`.

## Components

- [ ] Reused `.panel`, `.btn`, `.input`, `.chip`, `.eyebrow` or existing component.
- [ ] No new hardcoded palette, gradient or font.
- [ ] `CoverArt` used for covers.
- [ ] `FormatBadge`, `Rating`, `ReleaseCard`, `ReleaseRow` reused where applicable.
- [ ] `EmptyState` used instead of a custom empty block.

## Interaction

- [ ] Every icon-only button has `aria-label`.
- [ ] Dialog has `role="dialog"`, `aria-modal="true"`, Escape close and body scroll lock.
- [ ] Focus stays usable; first field or primary action is reachable.
- [ ] Destructive actions require a second click or confirmation.
- [ ] Loading and pending states disable repeated submits.

## Data

- [ ] `useQuery` key includes every filter.
- [ ] Mutations invalidate related queries.
- [ ] Success and failure both call `useToast`.
- [ ] `ApiError.message` is shown to the user.
- [ ] Price inputs use `parsePriceInput`.

## Layout

- [ ] Page header follows eyebrow → title → description → one accent action.
- [ ] Works at mobile width without horizontal scroll.
- [ ] Long titles truncate with `title` attribute.
- [ ] Dialog fits on a short mobile viewport.
- [ ] Mobile nav still has 4 destinations plus the add button.

## Finish

- [ ] `bun run check` passes.
- [ ] Touched flow exercised on desktop and mobile.
- [ ] `docs/development/design-system.md` updated if a new pattern was introduced.
