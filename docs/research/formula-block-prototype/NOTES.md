# Formula block prototype (issue #352)

PROTOTYPE — throwaway. Run: `node docs/research/formula-block-prototype/tui.mjs`.

**Question.** A pick from the formula library inserts a filled-in block with
example values. What are the block's lines and title, where is it placed, how does
the user see which lines are example values, and what happens when a name in the
block is already assigned on the sheet, above or below?

`blocks.mjs` holds the logic: three entries (rectangle second moment of area, von
Mises in plane stress, Euler buckling), the block's lines, and four ways to handle
a name that's already taken. It evaluates the sheet with plain math.js, as one scope
in reading order. `tui.mjs` inserts a block into three sample sheets and lists the
user's lines whose result changed.

## What it showed

- **Insert as is** (the block's names win, as any later line does today). On the beam
  sheet, three of the user's results changed silently: `I` went from 4.167e6 to
  1.707e6 mm^4, `sigma` from 36 to 70.31 MPa and `delta` from 0.76 to 1.86 mm.
  **Warn** changes the same results.
- **Rename every collision** (`b -> b_2`) keeps the user's results, but the block
  then ignores the values the user already has.
- **Use yours** keeps every user result, and the block computes from the user's
  values (`P_cr` = 53.97 kN from the user's aluminium column).
- **The trap no strategy fixes:** a block placed *above* the user's values for its
  inputs computes from its example values. `n = P_cr / F` gave 8.773 from 200 GPa
  steel, a plausible and wrong number.

## Verdict (agreed with the user, 2026-11-26)

- **Use yours.** An input that already has a value above the block is not set again:
  its line becomes `# b: uses yours, from above`. A result name already assigned on
  the sheet is renamed with the first free suffix (`I_2`). An input the user assigns
  only below the block keeps its example value.
- **The trap is reported by a toast at insert:** "E, L and I are also set below this
  block; it uses its own example values." Nothing is stored. Afterwards the block's
  lines are ordinary lines.
- **Example values: one comment line** under the title (`# Example values: replace
  them`), and nothing on each line.
- **Click to place,** as Add math does: a ghost box the size of the block, a click
  puts it, Esc cancels.
- **Title and source line.** The title is the entry's name in the language shown at
  insert. The block's last line is a comment, `# Source: <citation with locator>`.
