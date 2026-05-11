## 2024-05-18 - Logging API Keys and Auth Tokens
**Vulnerability:** The logger redactor (`src/logging.ts`) missed `authorization` and `api_key` properties, leaving them to be logged in plain text. Since this project uses Axios which throws errors containing full request config, any network failure would log the user's `Authorization` bearer token in plain text.
**Learning:** General "secret" filtering lists often miss context-specific keys like HTTP Authorization headers which are the most common source of leaked API credentials.
**Prevention:** Include standard authentication header keys (`authorization`, `api_key`, `apikey`) in all redaction filters.
