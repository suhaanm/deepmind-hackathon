# PTR: pointing / click accuracy

## Root cause (what was verified)
- `point_at` (grounder, box_2d) was NOT the problem: on the real Mac (1728x1117 points, Retina) the vision ring centre was within
  0.3-3.2 pt of the true key centre on 6 Calculator keys measured (median 1.5 pt, max 3.2 pt; keys are 48 pt wide). The mapping
  math (box_2d [ymin,xmin,ymax,xmax] order, 0-1000 divisor, points not pixels, primary-display origin) is correct and unit tested.
- The wrong clicks (`12+6,320`) come from the `act_for_me` loop: Gemini computer_use returns 0-999 coordinates on a whole-screen
  1920 px shot where a Calculator key is ~28 units wide, so a ~10-20 unit miss lands on a neighbouring key. The loop also used the
  model's raw point with no re-grounding right before the click. (Not measured numerically: computer_use needs a human approval
  click per run; the evidence is the 15:12 run and the geometry above.)

## Fix
- `src/main/agency/ax-resolver.ts` (new): Accessibility-first resolver. One JXA call (batched property reads, ~0.15-1 s,
  hard 1.5 s timeout, <=400 buttons, depth 9) reads role/title/description/AXIdentifier/frame of BUTTON-like controls of the
  frontmost app only (never text fields, values or password fields). A label (the model's intent / point_at target) is matched to
  an element by tokens (number words, + - x / = symbols, add/subtract...), unique best match, and within 260 pt of where vision
  pointed; else snap to the control containing the vision point; else keep the vision point. Own windows are never resolved.
  Flag: `ALONGSIDE_AX_RESOLVER=0` turns it off; off under vitest.
- `act-for-me.ts`: right before every click/double-click it re-resolves via AX, re-runs the policy/denylist on the resolved
  element words, moves the ring to the exact frame, and clicks the exact centre. A click after which the screen did not change
  now ends the task at once (was: after two).
- `point_at` (`tools/dispatcher.ts`): ring/arrow snap to the exact AX frame when the label matches confidently.
- `actuator/mapping.ts`: `pointsToNorm` (inverse of `normToPoints`). Tests: `src/main/agency/ax-resolver.test.ts` (18).
- No Clicky code was copied (its approach is the same screenshot-dimension mapping this app already has), so no notice added.

## Measurements (point_at, real Calculator, AX ground truth via System Events AXIdentifier frames)
| | n | median err | max err |
|---|---|---|---|
| vision ring centre (before) | 6 | 1.5 pt | 3.2 pt |
| AX-resolved ring centre (after) | 5 | 0.0 pt | 0.0 pt |
Keys Four, Six-Nine were not scored: AX read missed once (Four), and the harness's own ground-truth read failed for Six-Eight. Raw: scratchpad ptr/measure.json.

## Not verified / honest limits
- The act_for_me click loop with the AX resolver was NOT run end to end on the real Mac: the one real-click run needed an OS-level click on the in-app approval button, which the permission system refused, so it was not attempted. Only unit tests (loop with a stubbed resolver path, resolver maths) and the live AX reads/point_at above are verified. Keep ALONGSIDE_AGENCY_LOOP off until a human-approved run on Calculator confirms 12 + 30 = 42.
- Apps with no useful AX labels (web pages, Electron apps, canvases) still use vision-only coordinates (+-20 pt on small targets).
- Suggested next lever (not done): crop 2x around the vision point and re-ground for non-AX apps.
