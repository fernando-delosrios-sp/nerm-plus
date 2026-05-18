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

## 2024-05-20 - Extract duplicated object-resolution blocks into private helpers

**Learning:** Service classes containing multiple operations (like `addRole` and `removeRole` in `EntitlementService`) often duplicate 10-15 lines of setup logic, such as resolving identifiers (`user_id`) based on configuration (`account_type`) before performing the main action. This bloats functions and obscures the core intent.
**Action:** Extract the duplicated setup and resolution logic into a small, focused private helper method (e.g., `resolveUserIdForRole`). This keeps the main operation methods lean, focused on their primary action, and ensures consistency.
