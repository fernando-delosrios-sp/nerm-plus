🎯 **What:**
The `entity2profile` function in `src/utils.ts` had complex object mapping logic relying on recursive attribute resolution (`getAttribute`) and a status determination mapping `enabled` or `inactive` flags to string statuses. This logic lacked test coverage.

📊 **Coverage:**
- Added basic structure mappings (profile_type_id, mapped attributes, id mapping).
- Added checks for nested resolution logic by the inner `getAttribute`.
- Added edge cases covering status mapping rules (`enabled`, `inactive` combinations).

✨ **Result:**
The `entity2profile` logic is now fully covered by test suites ensuring regressions won't occur during future code refactoring or upgrades.
