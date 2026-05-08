## 2026-05-08 - Added Token and Secret redaction for Logs
**Vulnerability:** The logging function only removed 'password' values, leading to potential data leaks of tokens and secrets.
**Learning:** Found the redact logic was hardcoded to check only for 'password' and didn't cover other common sensitive patterns.
**Prevention:** Updated `src/logging.ts` redact function to check for strings containing 'token' and 'secret'.
