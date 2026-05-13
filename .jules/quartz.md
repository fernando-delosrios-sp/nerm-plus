## 2026-05-11 - Use guard clauses to flatten deeply nested logic

**Learning:** Functions that parse or translate external API schemas often fall into the trap of deeply nested `if/for` blocks (like `parents2children`). This creates a triangular structure where the actual logic is pushed far to the right and hidden behind tracking variables like `include`.
**Action:** Use early returns to exit fast when requirements (`parent_type`, `attribute`) are not met. Inside loops, use `continue` to bypass invalid items immediately rather than wrapping the valid items inside an `if (include)` block.

## 2024-05-20 - Flatten object returns in mappers

**Learning:** Functions that solely exist to map one object shape to another often declare a temporary variable, assign the mapped object to it, and return the variable (e.g. `const schema = { ... }; return schema;`). This adds unnecessary vertical space and visual noise.
**Action:** Use implicit returns with arrow functions `() => ({ ... })` to return mapped objects directly. This makes the mapping intention immediately obvious and removes the need for mental tracking of temporary variables.
