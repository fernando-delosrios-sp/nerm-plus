## 2024-05-30 - [Parallelizing Profile Attribute Resolution]

**Learning:** In the NERM connector, resolving profile attributes iterates over the connector schema definition attributes (`schema.attributes`), doing multiple async HTTP requests for each (`getAttributeRecursively`, `getUser`, etc). If done sequentially using a standard `for...of` loop with `await`, this is an N+1 query pattern that is O(n) based on the number of schema attributes configured.
**Action:** Used `Promise.all` over `schema.attributes.map` to trigger parallel resolution for each schema attribute. Rate limiting concerns are mitigated since the application uses `axios-request-throttle` to globally throttle HTTP traffic anyway, so resolving everything in parallel correctly builds maximum concurrent throughput up to the configured throttle limit, leading to dramatically faster initial account loads.

## 2024-05-10 - O(N²) Array Lookup Bottleneck in pushContents

**Learning:** Found a critical performance bottleneck in `src/services/push-service.ts` where an array of `ids` was being repeatedly searched using `Array.prototype.includes()` inside an async `for await` loop over `existingProfiles`. When dealing with potentially thousands of entities and profiles, this O(N) array lookup inside a loop causes an O(N²) time complexity which severely degrades performance during content sync.
**Action:** Always convert mapped arrays into a `Set` for O(1) lookups before iterating over large datasets that need to verify membership, especially in synchronization workflows.

## 2024-05-11 - Cache ProfileType fetches with Promise map

**Learning:** In highly concurrent architectures (like `PushService` iterating mappings or `SchemaService` resolving profiles), duplicate requests to the same endpoint (`/profile_types?name=X`) can stack up if they are triggered simultaneously. Caching the raw resolved value isn't enough to prevent redundant API calls during the initial burst.
**Action:** Implemented caching for `getProfileTypeByName` using a `Map<string, Promise<any>>`. By caching the pending Promise itself immediately, subsequent concurrent calls for the same profile type await the exact same Promise, effectively coalescing duplicate requests and saving network latency.

## 2024-05-12 - Cache Profile lookups with Promise map

**Learning:** Similarly to ProfileTypes, redundant queries for specific profiles by name and type stack up in concurrent processes such as attribute resolution or data pushes. and were issuing N requests for the same dependent profile.
**Action:** Implemented Promise map caching for profile queries by name and type to coalesce concurrent calls, reducing overhead and API requests.

## 2024-05-12 - Cache Profile lookups with Promise map

**Learning:** Similarly to ProfileTypes, redundant queries for specific profiles by name and type stack up in concurrent processes such as attribute resolution or data pushes. `getProfileByName` and `getProfileByNameAndType` were issuing N requests for the same dependent profile.
**Action:** Implemented Promise map caching for profile queries by name and type to coalesce concurrent calls, reducing overhead and API requests.

## 2024-05-31 - [Array includes in schema-service]

**Learning:** Found another `Array.prototype.includes()` bottleneck inside a loop in `src/services/schema-service.ts`. `schemaNames` was an array of strings, and inside a `for` loop over `resolvedProfiles`, `!schemaNames.includes(profile.name)` was called. If there are many profiles and schemas, this creates an O(N\*M) lookup.
**Action:** Transformed `schemaNames` to a `Set` for O(1) lookups: `new Set(schemas.map((x) => x.name))` and used `!schemaNames.has(profile.name)`, improving performance without sacrificing readability.

## 2026-05-14 - Prevent Duplicate API Calls for Users

**Learning:** API clients processing batch data or resolving multiple schemas concurrently may request the exact same entity (like a user by ID or email) repeatedly. Not caching these requests wastes network resources.
**Action:** Use an in-memory Map of Promises to cache and reuse the pending or resolved requests to avoid redundant API calls.

## 2025-02-18 - Optimize nested profile parent lookup in PushService

**Learning:** In `src/services/push-service.ts`, filtering an array of parent objects (`parentObjects.filter(...)`) inside an entity loop caused an O(N\*M) time complexity bottleneck during synchronization.
**Action:** Always preprocess mapped data arrays into a `Map` or `Set` outside of iterative processing loops to enable O(1) lookups and reduce time complexity to O(N+M).

## 2024-05-19 - Avoid N+1 queries in list aggregations

**Learning:** During list aggregations (e.g., `listAccounts`), redundantly re-fetching pre-fetched API items by ID (using functions like `getAccount`) causes severe N+1 query performance bottlenecks.
**Action:** Always pass the pre-fetched item objects yielded by list endpoint pagination directly to builder functions (like `buildAccount`) to significantly reduce API calls and speed up the process.
## 2024-05-21 - Optimize removeRole with concurrent deletion
**Learning:** Sequential await within a \`for await\` loop for independent HTTP DELETE requests creates an N+1 performance bottleneck. Because the project leverages \`axios-request-throttle\` to manage API concurrency limits, these requests can be safely parallelized.
**Action:** Used \`Promise.all\` to dispatch independent HTTP requests concurrently within asynchronous generator iteration blocks.
