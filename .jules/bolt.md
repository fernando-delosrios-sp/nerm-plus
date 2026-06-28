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

## 2026-05-19 - Optimize lookups in arrays using Set

**Learning:** Checking for element existence in an array inside a loop (using `.includes()`) leads to O(N\*M) time complexity, which can severely degrade performance as array sizes increase.
**Action:** Always preprocess mapped data arrays into a `Set` or `Map` outside of iterative processing loops to enable O(1) lookups instead of `.includes()`, reducing time complexity to O(N+M).
## 2024-06-25 - Avoid N+1 requests in user attribute sequential updates
**Learning:** Checking individual properties and immediately calling the update API (like `setUserAttribute`) repeatedly in sequential `if` blocks can lead to N+1 API request patterns.
**Action:** When conditionally updating multiple fields on the same entity, accumulate the modified fields into a single request body dictionary (e.g. `userUpdates`) and then execute a single unified API update (e.g. `updateUser(id, userUpdates)`).
## 2024-05-21 - Optimize removeRole with concurrent deletion
**Learning:** Sequential await within a \`for await\` loop for independent HTTP DELETE requests creates an N+1 performance bottleneck. Because the project leverages \`axios-request-throttle\` to manage API concurrency limits, these requests can be safely parallelized.
**Action:** Used \`Promise.all\` to dispatch independent HTTP requests concurrently within asynchronous generator iteration blocks.
## 2025-01-06 - Implement Profile Cache by ID
**Learning:** Calling `Promise.all` with a generator yielding mapping objects can result in N identical HTTP API queries if the method invoked isn't cached, leading to a performance cliff when generating lists.
**Action:** When implementing caching mechanisms, review all signature variations of an API retrieval function. Ensure basic fetch-by-ID operations use the same promise-map caching structure as complex multi-property lookup methods.

## 2024-05-20 - Cache NERM User Role Assignments

**Learning:** During account list aggregation or resolution of profiles that are associated with the same portal user ID, the `getUserRoleAssignments` method is called repeatedly. Because this wasn't cached, it resulted in an N+1 query problem, issuing redundant network requests for identical user IDs and slowing down overall synchronization.
**Action:** Implemented caching for `getUserRoleAssignments` using a Promise Map (similar to how `getUser` is cached). Now, parallel or subsequent resolutions for the same user wait on a single `Promise`, significantly decreasing redundant API calls and increasing performance.

## 2024-05-30 - Optimize hot path property extraction in getAttribute
**Learning:** In `src/utils.ts`, `getAttribute` is a highly iterative hot path used during account synchronization and property extraction. Using functional array reducers like `.split('.').reduce()` causes unnecessary O(N) heap allocation overhead and closures, which limits throughput.
**Action:** In hot loops, avoid functional array reducers for deep object extraction. Instead, use a minimal `const parts = path.split('.'); for(...)` loop, which is highly optimized in V8 and significantly outperforms the array reducer approach. Ensure semantic parity by explicitly checking for `obj != null` to accurately preserve or handle falsy values.

## 2024-06-26 - Optimize Leaf Extraction in Account Service
**Learning:** Using `.split('.').pop()` to extract a property suffix allocates a full array in the heap just to read the final element. In hot paths like account schema property mapping (which is highly iterative), this causes significant memory and GC churn.
**Action:** Prioritize allocation-free string operations: use `lastIndexOf('.')` and `.slice()` to extract substrings without intermediary array creation.

## 2024-06-27 - Implement concurrent batch processing with backpressure
**Learning:** To optimize performance when consuming items from an asynchronous generator (`for await`), sequentially awaiting each batch blocks the generator from fetching the next items, leading to significant idle time.
**Action:** Decouple stream consumption from batch processing by executing batches concurrently. Use a `Set` to track in-flight promises and enforce backpressure by calling `await Promise.race()` when the active pool reaches a maximum concurrency limit. Always track errors in a dedicated array to avoid silent failures.
