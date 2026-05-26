## 2026-05-11 - Use guard clauses to flatten deeply nested logic

**Learning:** Functions that parse or translate external API schemas often fall into the trap of deeply nested `if/for` blocks (like `parents2children`). This creates a triangular structure where the actual logic is pushed far to the right and hidden behind tracking variables like `include`.
**Action:** Use early returns to exit fast when requirements (`parent_type`, `attribute`) are not met. Inside loops, use `continue` to bypass invalid items immediately rather than wrapping the valid items inside an `if (include)` block.

## 2024-05-20 - Flatten object returns in mappers

**Learning:** Functions that solely exist to map one object shape to another often declare a temporary variable, assign the mapped object to it, and return the variable (e.g. `const schema = { ... }; return schema;`). This adds unnecessary vertical space and visual noise.
**Action:** Use implicit returns with arrow functions `() => ({ ... })` to return mapped objects directly. This makes the mapping intention immediately obvious and removes the need for mental tracking of temporary variables.

## 2024-05-20 - Flatten flow in entitlement-service with guard clauses

**Learning:** Operations processing logic like `removeType` or `runWorkflow` can suffer from deep nesting and 'arrow code' when validating inputs or states (e.g., verifying if an account type can be removed, or a requester exists).
**Action:** Use guard clauses to exit early (e.g., `return` or `throw new ConnectorError(...)`) when validation fails. This removes the need for large `else` blocks and allows the core logic to sit at the lowest possible indentation level, improving readability.

## 2024-05-20 - Extract repeated boolean logic into named helpers

**Learning:** Deeply nested logical ORs for string matching (e.g., checking if a key contains sensitive words like "password" or "token") add significant visual noise, especially when duplicated across different structures (like object keys vs. array element attributes).
**Action:** Extract the complex boolean string matching into a small named helper function (e.g., `isSensitiveKey(key)`). This clearly communicates intent, shrinks the size of the conditional blocks, and makes the main logic loops significantly easier to scan.

## 2024-05-20 - Flatten switch and nested flow with guard clauses

**Learning:** When validating inputs or states in operations logic (e.g., `addType`, `removeType` in `entitlement-service.ts`), `switch` statements with only one specific case and a `default` block, combined with nested `if/else` checks, lead to unnecessary indentation and harder-to-read 'arrow code'.
**Action:** Use early return or throw guard clauses (e.g., `throw new ConnectorError(...)`) to exit fast on invalid states. This eliminates the need for `switch` and large `else` blocks, keeping the main execution path at the lowest possible indentation level.
## 2026-05-19 - Extract Repeated Complex Boolean and Object Resolution Logic
**Learning:** Extracting duplicated, complex setup or object-resolution logic spanning multiple methods (like user ID validation based on `account_type` in `EntitlementService`) into private helper methods reduces duplication and improves the clarity of main operation flows.
**Action:** Identify repeated configuration checks and entity resolution blocks across service methods and extract them into focused, descriptive private helper methods.
## 2025-05-13 - Deduplicate Similar Switch Cases in Service Layer
**Learning:** When handling multiple configuration types (like `NeprofileUser` and `NeaccessUser`) in service methods, logic is often identically duplicated across parallel case statements, increasing visual noise and maintenance overhead.
**Action:** Use case fall-through to merge identical logic in switch statements, guarding any small type-specific differences (such as assigning `profile_id`) with a conditional check, keeping the switch block concise and DRY.

## 2024-05-25 - Group identical switch cases via fall-through
**Learning:** Service classes processing multiple specific types (like `NeprofileUser` and `NeaccessUser`) often implement identical handling logic across several lifecycle methods, leading to highly repetitive arrow code.
**Action:** When handling structurally similar types, use `case` fall-throughs in `switch` statements to group logic and eliminate duplication, using a small inner guard for any minor type-specific deviations.
## 2026-05-26 - Use string slicing for O(1) path resolution instead of arrays
**Learning:** Using `.split('.').reverse().join('.')` (and similar variants) for path manipulation not only adds O(N) array allocation overhead but can silently introduce logical bugs by reversing the nested order of child path segments (e.g., parsing `a.b.c` incorrectly to `c.b`).
**Action:** Avoid array-based tokenization for deep object paths and always favor O(1) string slicing using `indexOf('.')` and `slice()`.
