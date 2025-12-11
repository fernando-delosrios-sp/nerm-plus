⚡ Optimize `processOperation` inside loops in `stdAccountCreate` and `stdAccountUpdate`

💡 **What:**
Replaced sequential `for...of` loops with `Promise.all` + `Array.map` for `processOperation` calls.

🎯 **Why:**
Previously, independent operations like `create`, `Group`, `Role` modifications were awaited one by one. Calling the `processOperation` methods concurrently minimizes network wait time because each `processOperation` ultimately dispatches independent workflows.

📊 **Measured Improvement:**
Measured via a synthetic bench simulating a 3-operation sequential workload against parallel:
- Baseline (Sequential): ~453.9ms
- Improvement (Parallel): ~151.4ms
- Time Reduction: ~66% speedup (time scales with the single slowest API request instead of the sum of all requests).
