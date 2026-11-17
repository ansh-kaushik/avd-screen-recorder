# Use the documented meter motion for the audio level meters

Written against: `905e459` (branch `feat/audio-capture`)

## Evidence chain

- Surface: the two microphone level meters.
  - The sidebar's "Input level" meter: `src/components/AudioPanel.tsx`, about line 159, `<div className="meter-fill" ...>`.
  - The control bar's mic meter: `src/components/RecordingControls.tsx`, about line 123, `<div className="meter-fill" ...>`, shown when the mic is on.
- Problem: `.meter-fill` in `src/index.css` (line 382) sets `transition: width var(--motion-fast) linear;`. That uses the hover/press duration and an easing that isn't one of the named ones.
- Design evidence: `DESIGN.md`, app section "Recorder-specific rules", bullet **Motion**:
  - `--motion-mid` (0.2 s) is for switches and meters.
  - Only the named easings are used.

  The Ant Design reference ("Elevation & Depth" and "Do's and Don'ts") adds: don't pick a timing function arbitrarily, and use `motionEaseInOut` when nothing more specific fits.
- Owner: the `.meter-fill` rule in `src/index.css`. The tokens `--motion-mid` and `--ease-in-out` are defined on `:root` in the same file.
- Scope and affected surfaces: both meter consumers listed above. There are no other `.meter-fill` users.
- Uncertainty: the level is updated every animation frame by `src/useMic.ts`, which already smooths it with a decay of `prev * 0.85`. A 0.2 s transition makes the bar follow peaks a little more slowly. Confirm the meter still feels responsive (see Validation). If it doesn't, stop (see Stop conditions); don't invent a new duration.

## Design decision

Make the meter fill's width transition use `--motion-mid` with `--ease-in-out`, as the documented motion rule for meters says. This brings both meters in line with the switches, which already use `--motion-mid` and `--ease-in-out` on `.switch`.

## Reuse

- `--motion-mid` and `--ease-in-out`, both on `:root` in `src/index.css`.
- Exemplar: `.switch` in `src/index.css` (`transition: background var(--motion-mid) var(--ease-in-out)`).

No new primitive is needed.

## Changes

1. `src/index.css`, rule `.meter-fill`
   - Change: `transition: width var(--motion-fast) linear;` → `transition: width var(--motion-mid) var(--ease-in-out);`
   - Preserve: `height: 100%`; the default `--color-success` fill; the `[data-level='warn']` (`--color-warning`) and `[data-level='clip']` (`--color-error`) variants; and the `.meter` track styles.
   - Verify: in DevTools, `.meter-fill` has computed `transition-duration: 0.2s` and the `cubic-bezier(0.645, 0.045, 0.355, 1)` easing.

## Scope

- Inherit: the sidebar "Input level" meter and the control-bar mic meter.
- Verify: the colour still changes from green to amber to red at the existing thresholds (> 0.6 and > 0.9).
- Exclude: `.spin` (it matches antd's linear loading spinner); `.badge-processing` (antd's 1.2 s processing blink); the level calculation in `src/useMic.ts`.

## Validation

- Product: in the Electron app (`npm start`), turn the microphone on in the Audio sidebar and speak. Both meters rise with your voice and fall back during silence.
- Interface: check in the Light and Dark themes. Change the mic volume (0–200%) and mute it: the meter follows the post-gain level, and when muted it falls to empty.
- System: no new duration or easing is added. `grep -n "motion-fast) linear" src/index.css` should return nothing.
- Repository: `npx tsc -b && npx vite build` → both succeed with no errors.

## Stop conditions

- Stop if the meter feels laggy at 0.2 s in practice. Don't add a new token. Report back, so that the meter row of the Motion rule in `DESIGN.md` can be reconsidered instead.
- Stop if `.meter-fill` has gained consumers beyond the two meters listed above.

## Design documentation

- After acceptance and validation: none. If the stop condition about lag triggers, the follow-up is to change the "Motion" bullet in `DESIGN.md` (app section), not this plan.
