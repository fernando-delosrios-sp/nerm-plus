## 2024-05-18 - Prevent sensitive token and secret logging

**Vulnerability:** Application logs were only redacting `password` fields, potentially leaking `token` or `secret` fields from API payloads.
**Learning:** Hardcoding a single redact pattern (`password`) is insufficient for modern integrations that use various forms of authentication tokens and secrets.
**Prevention:** Extend redaction functions to handle a wider array of sensitive keys (e.g. `token`, `secret`) and ensure unit tests cover these specific data formats to catch potential regressions during cloning (`{...obj}`).

## 2026-05-10 - Error Serialization Bypassing Redaction

**Vulnerability:** HTTP error payloads in `nerm-client.ts` were serialized using `JSON.stringify`, bypassing the central `toLogString` and `redact` logic, potentially leaking sensitive error data (e.g., failed login attempts exposing passwords or tokens in standard log formats).
**Learning:** Relying on default JSON serialization for external error responses can easily bypass security redaction logic intended for regular logging paths.
**Prevention:** Ensure all logging of error responses and data structures uses standardized redaction utilities (`toLogString`) rather than raw `JSON.stringify`.
