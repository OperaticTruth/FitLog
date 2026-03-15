# FitLog Bug Fixes PRD

## Project Structure
- `frontend/workouts.html` — Single-file frontend (HTML + CSS + JS, ~1,140 lines)
- `backend/main.py` — FastAPI + PostgreSQL backend
- `index.html` — Main FitLog app (measurements, weight, photos)

## Bug 1: Generate Workout — Allow Up To 5 Days Out
**Current behavior:** The "Generate Workout" button is only clickable for the current calendar day.
**Expected behavior:** Allow generating workouts for today + up to 5 calendar days in the future.
**Where to look:** `frontend/workouts.html` — search for the generate button's disabled/enabled logic. There's likely a date comparison that restricts it to today only. Change it to allow `today <= selectedDate <= today + 5 days`.
**Also verify:** The generate endpoint actually works (calls Claude API via `/workouts/generate`). The backend uses `ANTHROPIC_API_KEY` env var. If missing, it falls back to template workouts. Make sure the button is clickable and the request goes through.

## Bug 2: Photo Upload — Allow Camera Roll
**Current behavior:** The photo upload button only opens the camera (capture mode).
**Expected behavior:** Allow both taking a photo AND uploading from camera roll/gallery.
**Where to look:** `index.html` — search for `<input type="file"` with `capture="environment"` or `capture="camera"`. Remove or make the `capture` attribute optional so the browser shows both camera and gallery options. The fix is likely changing `accept="image/*" capture="environment"` to just `accept="image/*"`.

## Bug 3: Measurements — Unchanged Values Showing Red
**Current behavior:** When measurements haven't changed between two logging sessions (same value), the delta shows in RED, same as negative changes.
**Expected behavior:** Unchanged values (delta = 0) should show in a NEUTRAL color (use `var(--text-dim)` or `var(--orange)` — something clearly different from red/green).
**Where to look:** `index.html` — search for the measurement comparison/delta display logic. There should be a conditional that checks if the value went up (green), down (red), or stayed the same. Add a third condition for delta === 0 that uses a neutral color like `var(--text-dim)` gray or `var(--orange)` amber.
**Context on color meaning:** For body measurements, "bigger" isn't always bad (legs, arms = good) and "smaller" isn't always bad (waist = good). The current logic might be too simplistic. But for THIS fix, just make zero-change a neutral color instead of red.

## Bug 4: Measurements Log Form — Responsive Overflow
**Current behavior:** When clicking "+ Log" to start logging measurements, the form doesn't fully fit on mobile. The far right ~10% is cut off.
**Expected behavior:** The form should be fully visible on mobile screens with no horizontal overflow.
**Where to look:** `index.html` — search for the measurement logging form/modal. Likely a `max-width`, `padding`, or `width` issue. Check for hardcoded widths or insufficient padding on the container. Add `overflow-x: hidden` or adjust the grid/flex layout. Test at 375px width (iPhone SE) as minimum target.

## Bug 5: Manual Workout Entry
**Current behavior:** No way to manually enter a workout. The only option is "Generate Workout" via AI.
**Expected behavior:** Add a "Manual Workout" button next to "Generate Workout" that lets the user:
  1. Type in exercises manually (name, sets, reps, weight)
  2. OR pick exercises from the existing Exercise Library
**Where to look:** `frontend/workouts.html` — the Today page already has a "Generate Workout" button. Add a "Manual Workout" button next to it. When clicked, show a form/modal where the user can:
  - Add exercises one by one (name input + muscle dropdown + sets/reps/weight fields)
  - OR browse the exercise library and tap to add exercises
  - Set the workout title and notes
  - Save the workout via the existing `/workouts` POST endpoint

## Bug 6: Measurement Display Order — L/R Pairs Misaligned
**Current behavior:** In the measurement view/form grid, left and right measurements are visually flipped. The layout shows: Arm L (right column), Arm R (left column below), Flexed L (right), Flexed R (left), Thigh L (right), Thigh R (left). This makes it confusing to read.
**Expected behavior:** Left measurements should always appear on the LEFT side of the grid, right measurements on the RIGHT side, in logical pairs:
  - Row: Arm L (left) | Arm R (right)
  - Row: Flexed L (left) | Flexed R (right)
  - Row: Thigh L (left) | Thigh R (right)
**Where to look:** `index.html` — the measurement form grid and the measurement display/comparison view. The issue is likely the order of fields in the HTML or the grid layout (auto-fill wrapping). Fix by ensuring paired L/R fields are adjacent in the markup and the grid renders them left-to-right consistently. This applies to BOTH the input form AND the display/comparison view.

## Testing
After changes, verify:
- [ ] Generate button works for today AND future dates (up to 5 days)
- [ ] Generate button is disabled for dates more than 5 days out
- [ ] Photo upload shows both camera and gallery options on mobile
- [ ] Unchanged measurements show neutral color (not red)
- [ ] Measurement form fits fully on mobile (no horizontal scroll)
- [ ] Manual workout entry allows adding exercises and saving
- [ ] All existing functionality still works (history, PRs, schedule, settings)
