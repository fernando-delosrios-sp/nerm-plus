🔒 [Security] Redact sensitive information from logs

🎯 **What:**
The connector was logging potentially sensitive information in plaintext, primarily passwords. Input payloads and changes were being stringified and logged without any redaction (e.g. `logger.debug(\`Creating account with input: \${JSON.stringify(input)}\`)`). Additionally, `opStart` and `opEnd` logged full objects via `toLogString` which just called `JSON.stringify()`.

⚠️ **Risk:**
When users create accounts or update passwords, those passwords would be recorded in plain text in connector or systemic logs. Anyone with access to the logs could intercept and compromise user credentials, leading to unauthorized access and severe privilege escalation.

🛡️ **Solution:**
- Implemented a `redact` function in `src/logging.ts` that deeply clones an object and replaces any value associated with a key containing "password" (case-insensitive) with `[REDACTED]`. It also specifically handles the `{ attribute: 'password', value: '...' }` structures seen in `input.changes`.
- Updated the `toLogString` helper to apply this `redact` function before stringifying.
- Updated all instances in `src/index.ts` where full objects were being logged directly (e.g., using `JSON.stringify(input)` or `logger.info(input)`) to use the secure `toLogString(input)` helper.
