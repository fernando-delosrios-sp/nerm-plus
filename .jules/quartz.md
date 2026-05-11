## 2025-02-14 - Refactor complex recursive nested object access

**Learning:** `getAttribute` function in `src/utils.ts` had a confusing, recursively branching nested object access that split attributes, reversed them, mutated state and recurred over itself. This made it very difficult to understand its function at a glance.
**Action:** Replaced the recursion with a clean `for...of` loop that splits by `.` and iterates, guarding against nulls or undefined values natively. Simple iterative loops are vastly more readable than over-engineered recursion for dot-notation property traversal.
