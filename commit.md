🧪 Add tests for getRoleType in utils.ts

- 🎯 **What:** The testing gap addressed: Missing tests for `getRoleType` in `src/utils.ts`. It also fixes a minor edge case where `uid` is undefined or null, which previously would throw an error if passed into `getRoleType`.
- 📊 **Coverage:** What scenarios are now tested:
  - When `uid` ends with 'neprofile_role'.
  - When `uid` does not end with 'neprofile_role'.
  - When `uid` is an empty string.
  - When `uid` is undefined.
  - When `uid` is null.
- ✨ **Result:** The improvement in test coverage: Improved resilience of `getRoleType` in edge cases where the property `uid` may be missing or null, and 100% test coverage for this specific utility function is introduced.
