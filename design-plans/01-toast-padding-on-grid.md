# Put toast padding on the 4 px spacing grid

Written against: `905e459` (branch `feat/audio-capture`)

## Evidence chain

- Surface: the toast at the top of the main AVD Studio window. `src/App.tsx` renders it at about line 254 as `<div className="toast" ...>` whenever `toastMessage` is set. That happens on recording start, pause, resume, stop, discard, save and errors.
- Problem: `.toast` in `src/index.css` (line 345) sets `padding: 9px 12px;`. 9 px is not on the 4 px grid.
- Design evidence: `DESIGN.md`, in the Ant Design reference under "Layout", says all spacing snaps to a 4 px grid and that magic numbers such as `padding: 11px` do not appear. Its "Do's and Don'ts" adds: snap every gap, inset and gutter to the grid, and don't use magic numbers. The only listed exception is the input field's 11 px horizontal padding. The app section ("Layout") repeats that every gap and inset sits on the 4 px grid.
- Owner: the `.toast` rule in `src/index.css`.
- Scope and affected surfaces: every toast. `.toast` has one consumer, `src/App.tsx`.
- Uncertainty: none. Upstream antd's message component also uses 9 px, but `DESIGN.md` does not list it as an exception.

## Design decision

Change the vertical toast padding from 9 px to 8 px, the nearest grid step (`sm` in the spacing scale). Horizontal padding stays at 12 px, which is already on the grid. This keeps the toast's look while meeting the documented spacing rule.

## Reuse

- Spacing scale step `sm` = 8 px (`DESIGN.md` front-matter, `spacing.sm`).
- Exemplar: `.alert` in `src/index.css`, which uses `padding: 8px 12px` for the same kind of compact feedback surface.

No new primitive is needed.

## Changes

1. `src/index.css`, rule `.toast`
   - Change: `padding: 9px 12px;` → `padding: 8px 12px;`
   - Preserve: everything else in `.toast`: position, `--bg-elevated` background, `--shadow`, `--radius-lg`, the 8 px icon gap, and the `toast-in` animation.
   - Verify: in DevTools, the toast's computed padding is `8px 12px`.

## Scope

- Inherit: all toast messages from `src/App.tsx` (`showToast`).
- Verify: the toast still sits centred at the top in light and dark themes, and the icon and text stay vertically centred.
- Exclude: `.alert`, which is already correct; the input field's 11 px exception; all other spacing.

## Validation

- Product: start a recording with an emulator connected. A "Recording started…" toast appears with a success icon.
- Interface: trigger an error toast too (for example, press Record with no device connected), and check both in the System, Light and Dark themes at 1280×800.
- System: the toast still uses the existing tokens and no new spacing value is added. The only off-grid padding left in `src/index.css` should be the input's 11 px.
- Repository: `npx tsc -b && npx vite build` → both succeed with no errors.

## Stop conditions

- Stop if `.toast` is no longer the only toast style (another toast class or component has appeared), or if `DESIGN.md` now lists the toast's 9 px as an exception.

## Design documentation

- After acceptance and validation: none. The code now follows the existing rule.
