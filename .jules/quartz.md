## 2024-11-20 - Simplify sequential lookups with nullish coalescing
**Learning:** Sequential fallback lookups (e.g., `let x = findA(); if (!x) x = findB();`) can be simplified into a single statement using the nullish coalescing operator (`??`), allowing the variable to be declared as `const` rather than `let` and reducing visual noise.
**Action:** When acting as the 'Quartz' persona, simplify sequential fallback lookups by using a single `const` declaration with `??` instead of mutable reassignment.
