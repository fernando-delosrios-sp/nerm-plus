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
**Learning:** Similarly to ProfileTypes, redundant queries for specific profiles by name and type stack up in concurrent processes such as attribute resolution or data pushes.  and  were issuing N requests for the same dependent profile.
**Action:** Implemented Promise map caching for profile queries by name and type to coalesce concurrent calls, reducing overhead and API requests.

## 2024-05-12 - Cache Profile lookups with Promise map
**Learning:** Similarly to ProfileTypes, redundant queries for specific profiles by name and type stack up in concurrent processes such as attribute resolution or data pushes. `getProfileByName` and `getProfileByNameAndType` were issuing N requests for the same dependent profile.
**Action:** Implemented Promise map caching for profile queries by name and type to coalesce concurrent calls, reducing overhead and API requests.
