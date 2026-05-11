## 2024-05-10 - Simplification of Object Path Traversal

**Learning:** Traversing nested objects dynamically using string paths can become hard to read when implemented with recursive string splitting and array reversals.
**Action:** Use `.split('.').reduce()` to traverse object paths sequentially, improving clarity and removing recursive complexity.
