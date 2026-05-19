## 2026-05-19 - Extract Repeated Complex Boolean and Object Resolution Logic
**Learning:** Extracting duplicated, complex setup or object-resolution logic spanning multiple methods (like user ID validation based on `account_type` in `EntitlementService`) into private helper methods reduces duplication and improves the clarity of main operation flows.
**Action:** Identify repeated configuration checks and entity resolution blocks across service methods and extract them into focused, descriptive private helper methods.
