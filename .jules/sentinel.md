## 2024-05-18 - Prevent sensitive token and secret logging

**Vulnerability:** Application logs were only redacting `password` fields, potentially leaking `token` or `secret` fields from API payloads.
**Learning:** Hardcoding a single redact pattern (`password`) is insufficient for modern integrations that use various forms of authentication tokens and secrets.
**Prevention:** Extend redaction functions to handle a wider array of sensitive keys (e.g. `token`, `secret`) and ensure unit tests cover these specific data formats to catch potential regressions during cloning (`{...obj}`).

## 2026-05-10 - Error Serialization Bypassing Redaction

**Vulnerability:** HTTP error payloads in `nerm-client.ts` were serialized using `JSON.stringify`, bypassing the central `toLogString` and `redact` logic, potentially leaking sensitive error data (e.g., failed login attempts exposing passwords or tokens in standard log formats).
**Learning:** Relying on default JSON serialization for external error responses can easily bypass security redaction logic intended for regular logging paths.
**Prevention:** Ensure all logging of error responses and data structures uses standardized redaction utilities (`toLogString`) rather than raw `JSON.stringify`.

## 2024-05-18 - Logging API Keys and Auth Tokens

**Vulnerability:** The logger redactor (`src/logging.ts`) missed `authorization` and `api_key` properties, leaving them to be logged in plain text. Since this project uses Axios which throws errors containing full request config, any network failure would log the user's `Authorization` bearer token in plain text.
**Learning:** General "secret" filtering lists often miss context-specific keys like HTTP Authorization headers which are the most common source of leaked API credentials.
**Prevention:** Include standard authentication header keys (`authorization`, `api_key`, `apikey`) in all redaction filters.

## 2026-05-11 - [Prevent Infinite Recursion DOS in Log Redaction]

**Vulnerability:** A Denial of Service (DoS) vulnerability existed in `src/logging.ts` where the custom recursive `redact` function lacked cycle detection. When error objects containing circular references (like typical `AxiosError` instances commonly passed to the logger) were logged, it resulted in a `RangeError: Maximum call stack size exceeded`, causing the application to crash.
**Learning:** Security resilience includes ensuring that error handling and logging paths do not crash the application when provided with deeply nested or cyclical structures, which could otherwise be exploited or routinely hit during normal error flows.
**Prevention:** Always track visited objects (e.g., using `WeakSet` or similar robust cycle-detection) when recursively deep-cloning or stringifying arbitrary/uncontrolled input in custom utility functions.

## 2026-05-12 - Prevent secrets leaking in stringified JSON logs

**Vulnerability:** A vulnerability existed where secrets like tokens, api_keys or passwords could leak in plain-text logs if they were encoded in stringified JSON objects (such as `AxiosError.config.data` payloads), because the `redact` filter function in `src/logging.ts` didn't parse strings.
**Learning:** Security redaction functions often focus entirely on object traversal and bypass strings. Deep stringified JSON is a very common place for API secrets to hide during API request failures and logs.
**Prevention:** Check strings to see if they might be stringified JSON objects/arrays. If they are, safely run `JSON.parse`, redact the resulting object, and `JSON.stringify` it back to a string before returning. Ensure comprehensive `try...catch` behavior to prevent crashes on invalid strings.

## 2024-05-26 - URL-encoded Secret Redaction

**Vulnerability:** URL-encoded form data (e.g. `client_id=123&client_secret=secret`) is sometimes sent or logged, leaking secrets in plain text because the `redact()` logger only checked JSON structures and object keys, not raw string parameters.
**Learning:** External API tokens, passwords, and sensitive keys embedded within URL-encoded payload strings bypassing simple log redaction can still lead to secret leakage. Heuristics with strict constraints must be carefully crafted to avoid corrupting standard logging outputs.
**Prevention:** Implement deep payload parsing by utilizing `URLSearchParams` to extract and redact sensitive query parameters from string payloads containing `&` and `=`, but avoid matching URLs directly or plain-text strings with spaces.

## 2024-06-23 - Prevent Path Traversal and URL Injection

**Vulnerability:** API endpoints in `nerm-client.ts` were constructed via template literals interpolating dynamic variables without URL-encoding them (e.g., `` `/profiles/${id}` ``).
**Learning:** If a malicious or malformed `id` containing characters like `/`, `?`, or `%` is passed, it can alter the API route resulting in path traversal or bypassing expected endpoint logic.
**Prevention:** Always wrap dynamically interpolated path or query variables with `encodeURIComponent(String(var))` when building API routes to safely neutralize any special HTTP characters.

## 2026-06-23 - Prevent Regex Denial of Service (ReDoS) in String Validation

**Vulnerability:** A Regular Expression Denial of Service (ReDoS) vulnerability could be triggered in UUID validation if the regex engine processed untrusted, dynamically-sized strings without bounds checking.
**Learning:** Even well-anchored regular expressions can experience performance degradation or trigger static analysis security warnings if they are applied to unbound, arbitrarily long string inputs from untrusted sources.
**Prevention:** Enforce strict string length checks (e.g., `value.length === 36`) prior to executing regular expressions on specific formats to safely neutralize ReDoS risks and ensure optimal regex engine performance by short-circuiting fast on non-compliant input.

## 2026-06-23 - Prevent Secrets Leaking in Full URLs in Logs

**Vulnerability:** Full URLs (e.g., `https://...` or `/api/...`) containing sensitive query parameters (like `client_secret` or `token`) were not redacted by the logger because the heuristic explicitly ignored strings containing `://` or lacked base domains.
**Learning:** Only parsing pure query string formats (e.g., `a=1&b=2`) leaves full URLs exposed when they are inadvertently logged in request objects or errors (e.g., `AxiosError.config.url`). Furthermore, valid search parameter strings without an `&` (`?password=1`) may bypass basic match heuristics.
**Prevention:** Attempt to parse string patterns containing `=` and `&` natively using the `URL` API (handling relative paths and bare query strings gracefully with dummy origins). If successful, extract and sanitize `url.searchParams` before reconstructing the string exactly.
