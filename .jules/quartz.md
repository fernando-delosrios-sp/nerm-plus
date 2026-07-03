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
## 2024-06-25 - Handle undefined attributes in profile2Entitlement gracefully
**Learning:** Hard-coded property assignments in object mapping iterations are vulnerable to runtime errors if the source property is missing. Existing tests may accidentally "expect" this broken behavior rather than validating a correct fix.
**Action:** Always use optional chaining (`?.[key]`) or safe fallbacks when mapping properties dynamically. Furthermore, always check if there are tests expecting `.toThrow()` for the exact error being fixed and update them to expect a graceful fallback.
## 2026-05-21 - Flatten conditionals with guard clauses
**Learning:** When validating inputs or states in operations logic (e.g., `addType`, `addWorkflow` in `entitlement-service.ts`), deep nesting often occurs when using 'if-else' structures for primary failure or presence checks.
**Action:** Use early return or throw guard clauses (e.g., `if (!workflow) throw...` or `if (user_id) { ... return }`) instead of nested switch or else blocks to avoid deeply nested 'arrow code' and keep the execution path at a shallow indentation level.

## 2026-05-19 - Use case fall-through to eliminate switch redundancy
**Learning:** Services like AccountService and AttributeService sometimes process identical or nearly identical execution paths for multiple subtypes (e.g., NeprofileUser and NeaccessUser) inside large switch blocks.
**Action:** Merge identical cases using switch case fall-through (`case A: case B: ... break;`), and extract any minor differences (like setting an extra property) into an internal `if` check. This reduces code duplication and improves scannability.
## 2026-05-19 - Refactor switch statements with case fall-through

**Learning:** When switch statements in services (like AccountService) contain cases that share identical or nearly identical handling logic (e.g., for NeprofileUser and NeaccessUser), it leads to redundant code blocks that are harder to maintain and read.
**Action:** Use case fall-through to merge identical logic for multiple switch cases. If there are minor type-specific differences, guard them with an internal conditional (e.g., `if (type === 'NeaccessUser') {...}`) within the combined block.
## 2025-05-13 - Deduplicate Similar Switch Cases in Service Layer
**Learning:** When handling multiple configuration types (like `NeprofileUser` and `NeaccessUser`) in service methods, logic is often identically duplicated across parallel case statements, increasing visual noise and maintenance overhead.
**Action:** Use case fall-through to merge identical logic in switch statements, guarding any small type-specific differences (such as assigning `profile_id`) with a conditional check, keeping the switch block concise and DRY.

## 2024-05-25 - Group identical switch cases via fall-through
**Learning:** Service classes processing multiple specific types (like `NeprofileUser` and `NeaccessUser`) often implement identical handling logic across several lifecycle methods, leading to highly repetitive arrow code.
**Action:** When handling structurally similar types, use `case` fall-throughs in `switch` statements to group logic and eliminate duplication, using a small inner guard for any minor type-specific deviations.
## 2026-05-26 - Use string slicing for O(1) path resolution instead of arrays
**Learning:** Using `.split('.').reverse().join('.')` (and similar variants) for path manipulation not only adds O(N) array allocation overhead but can silently introduce logical bugs by reversing the nested order of child path segments (e.g., parsing `a.b.c` incorrectly to `c.b`).
**Action:** Avoid array-based tokenization for deep object paths and always favor O(1) string slicing using `indexOf('.')` and `slice()`.
## 2026-06-23 - Simplify undefined/null checks with loose inequality and nullish coalescing

**Learning:** Verbose checks for both `!== undefined` and `!== null` combined with ternary fallbacks add unnecessary visual noise and make the code harder to scan, especially in deeply nested loops or attribute mappers.
**Action:** Use loose inequality (`!= null`) to check for both `null` and `undefined` simultaneously. Use the nullish coalescing operator (`??`) to provide fallbacks instead of verbose ternary operators. This drastically reduces boilerplate and highlights the intent.

## 2024-06-25 - Pass evaluated generic types directly instead of using conditional branches

**Learning:** When a variable's type is dynamically resolved into a strict union type (like `'NeprofileUser' | 'NeaccessUser'`), it's a common anti-pattern to write explicit conditional branches (e.g., `if (type === 'NeprofileUser') addType('NeprofileUser') else addType('NeaccessUser')`) to dispatch exactly the same operation using hardcoded string literals. This clutters the flow and creates unnecessary mental overhead.
**Action:** Simply pass the resolved type variable directly to the consuming function (e.g., `await this.addType(account, type)`), which handles the type-checking and behavior itself. This dramatically reduces boilerplate and clearly communicates the intent.

## 2026-06-25 - Extract identical logic from conditional branches
**Learning:** In deeply nested conditionals (like processing logic for specific types in `AccountService`), subsequent state mapping (like assigning `roles`) is often copy-pasted verbatim into both branches of the conditional to handle minor fetching differences.
**Action:** Extract the identical mapping or assignment logic completely out of the conditional block. Execute the distinct fetching logic inside the branches, store the results in a shared variable, and apply the mapping once at the end of the block.

## 2026-06-25 - Simplify redundant boolean logic and ternary operators
**Learning:** Returning redundant boolean evaluation within a ternary operation (`value === 'Active' ? false : true` or `foo ? true : false`) adds unnecessary clutter.
**Action:** Use direct boolean checks (like `value !== 'Active'`) or explicit boolean casting (`Boolean(foo)`) to highlight the intent of the check and decrease cognitive load.
