## 2024-05-18 - Prevent sensitive token and secret logging
**Vulnerability:** Application logs were only redacting `password` fields, potentially leaking `token` or `secret` fields from API payloads.
**Learning:** Hardcoding a single redact pattern (`password`) is insufficient for modern integrations that use various forms of authentication tokens and secrets.
**Prevention:** Extend redaction functions to handle a wider array of sensitive keys (e.g. `token`, `secret`) and ensure unit tests cover these specific data formats to catch potential regressions during cloning (`{...obj}`).
