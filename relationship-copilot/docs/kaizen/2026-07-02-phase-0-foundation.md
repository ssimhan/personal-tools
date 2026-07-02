1. Target workflow: plan
   Where: Pre-Plan Checks
   Edit:
   Before planning database, browser, or provider tests, run a read-only toolchain preflight for every required local runtime. Record missing container runtimes, CLIs, browser engines, and environment-variable sources as explicit preconditions, including which installation or system-start actions will require user approval.

2. Target workflow: plan
   Where: Authentication and identity chunks
   Edit:
   When a phase introduces email, OAuth, passwordless, or callback authentication, require one integration test that starts at the user-facing request surface and ends on an authenticated protected route. The test must exercise the real local delivery sink or provider sandbox, callback parameters, redirect origin, session-cookie propagation, and unauthorized fallback; route-unit tests alone do not satisfy the chunk.

3. Target workflow: build
   Where: Per-chunk verification
   Edit:
   For every new networked SDK or HTTP adapter, verify before commit that the request path has an explicit deadline, propagates an upstream abort signal, and releases timers/listeners in `finally`. Add a focused RED test for timeout and cancellation behavior even when the SDK provides undocumented defaults.

4. Target workflow: build
   Where: UI quality gate
   Edit:
   For new or changed primary actions, add a rendered-browser accessibility contract before visual sign-off: compute normal-sized text contrast at 4.5:1 or better, verify a 44px minimum target, confirm visible keyboard focus, and inspect the narrowest supported viewport for horizontal overflow.

5. Target workflow: audit
   Where: Technical Audit
   Edit:
   For authentication flows, compare the configured application origin, email or provider callback URL, route-handler redirect destination, and resulting cookie domain. Exercise the complete callback in a real browser and fail the audit if `localhost`, `127.0.0.1`, preview hosts, or proxy-normalized hosts can diverge and strand a valid session.
