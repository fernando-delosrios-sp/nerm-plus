## 2025-02-14 - Refactor complex recursive nested object access

**Learning:** `getAttribute` function in `src/utils.ts` had a confusing, recursively branching nested object access that split attributes, reversed them, mutated state and recurred over itself. This made it very difficult to understand its function at a glance.
**Action:** Replaced the recursion with a clean `for...of` loop that splits by `.` and iterates, guarding against nulls or undefined values natively. Simple iterative loops are vastly more readable than over-engineered recursion for dot-notation property traversal.
**Learning:** `getAttribute` function in `src/utils.ts` had a confusing, recursively branching nested object access that split attributes, reversed them, mutated state and recurred over itself. This made it very difficult to understand its function at a glance.
**Action:** Replaced the recursion with a clean `for...of` loop that splits by `.` and iterates, guarding against nulls or undefined values natively. Simple iterative loops are vastly more readable than over-engineered recursion for dot-notation property traversal.

## 2026-05-11 - Use guard clauses to flatten deeply nested logic
**Learning:** Functions that parse or translate external API schemas often fall into the trap of deeply nested `if/for` blocks (like `parents2children`). This creates a triangular structure where the actual logic is pushed far to the right and hidden behind tracking variables like `include`.
**Action:** Use early returns to exit fast when requirements (`parent_type`, `attribute`) are not met. Inside loops, use `continue` to bypass invalid items immediately rather than wrapping the valid items inside an `if (include)` block.

## 2025-02-14 - Extract inline duplicated checks into well-named predicates
**Learning:** `src/logging.ts` repeated a block of `includes` checks on a string to verify if it was a sensitive key both in the main object keys and inside a specific `changes` array element. This inline density obscured the primary intent of the `redact` logic.
**Action:** Extracting such dense conditional blocks into a focused predicate function (e.g. `isSensitiveKey(key: string)`) drastically improves scannability and prevents copy-paste errors when logic needs to evolve.
