## 2025-02-14 - Refactor complex recursive nested object access
**Learning:** `getAttribute` function in `src/utils.ts` had a confusing, recursively branching nested object access that split attributes, reversed them, mutated state and recurred over itself. This made it very difficult to understand its function at a glance.
**Action:** Replaced the recursion with a clean `for...of` loop that splits by `.` and iterates, guarding against nulls or undefined values natively. Simple iterative loops are vastly more readable than over-engineered recursion for dot-notation property traversal.

## 2026-05-11 - Use guard clauses to flatten deeply nested logic
**Learning:** Functions that parse or translate external API schemas often fall into the trap of deeply nested `if/for` blocks (like `parents2children`). This creates a triangular structure where the actual logic is pushed far to the right and hidden behind tracking variables like `include`.
**Action:** Use early returns to exit fast when requirements (`parent_type`, `attribute`) are not met. Inside loops, use `continue` to bypass invalid items immediately rather than wrapping the valid items inside an `if (include)` block.