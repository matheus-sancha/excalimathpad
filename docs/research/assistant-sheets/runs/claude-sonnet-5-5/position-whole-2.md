# claude-sonnet-5-5, position, guide whole, trial 2

Cost $0.0447, 6.3 s in all.

> Hole position check to ASME Y14.5, RFS. Measured deviation from true position: dx = 0.08 mm, dy = -0.05 mm. Position tolerance 0.25 mm (a diameter). I want the true position value, a Pass/Fail line in green and red, the percentage of the tolerance used, the margin, and a plot of the point inside the tolerance circle.

## First answer

6.3 s, 18403 tokens in, 792 out.
1 elements, 8 lines, 4 comment lines; 0 errors, 0 warnings, 0 with failed points.
Forms: comment 4, display unit 3, rule 1, condition 1, plot 1

### The sheet as the engine reads it

```
unit system: SI, Digits: 4

E1  title: "True position, RFS (ASME Y14.5)"
  1 | # Measured deviations from the true position (inputs)
  2 | dx = 0.08 mm
    = (input)
  3 | dy = -0.05 mm
    = (input)
  4 | # Position tolerance, a diameter, RFS: no bonus tolerance from feature size
  5 | T_p = 0.25 mm
    = (input)
  6 | # True position value: the diameter of the zone the hole's axis sits in
  7 | TP = 2 sqrt(dx^2 + dy^2) in mm
    = 0.1887 mm
  8 | check = if(TP <= T_p, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
    = Pass
  9 | used = TP / T_p in %
    = 75.47 %
 10 | margin = T_p - TP in mm
    = 0.06132 mm
 11 | # The tolerance zone is a circle of diameter T_p, so its radius is T_p / 2
 12 | plot(dx, dy), circle T_p / 2, title "True position"
    = plot, 0 points, 0 series, 1 dots, 1 circles, 0 failed; x dx [mm], y dy [mm]

```

### The answer as written

Title: True position, RFS (ASME Y14.5)
~~~
# Measured deviations from the true position (inputs)
dx = 0.08 mm
dy = -0.05 mm
# Position tolerance, a diameter, RFS: no bonus tolerance from feature size
T_p = 0.25 mm
# True position value: the diameter of the zone the hole's axis sits in
TP = 2 sqrt(dx^2 + dy^2) in mm
check = if(TP <= T_p, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
used = TP / T_p in %
margin = T_p - TP in mm
# The tolerance zone is a circle of diameter T_p, so its radius is T_p / 2
plot(dx, dy), circle T_p / 2, title "True position"
~~~

- `TP` is twice the radial deviation, which is how a diameter tolerance is compared. The name `TP` avoids `T`, the tesla.
- `margin` goes negative when the part fails. The dot then moves outside the circle.
- I assumed that `dx` and `dy` are measured from the true position and that the tolerance is not modified by a material condition. Check both, and the way the position value is evaluated, against your copy of ASME Y14.5.
