# Submission

Approximate time spent: 2 hours.

## What I Did

- Prioritized reliable creation, persistence and redirects, followed by recorded click statistics, abuse protection, the interface and Docker delivery.
- Separated domain rules and use cases from HTTP and storage adapters, with explicit contracts, validation and error handling.
- Replaced in-memory storage and the collision-prone generator with Prisma/SQLite, cryptographic codes and atomic counters.
- Built a minimal responsive interface using SCSS and the BEM naming convention, with validation, pending feedback, clipboard copying and a shared list of links and statistics.
- Added automated tests, type checking, consistent formatting and reproducible Docker startup. Setup and verification instructions are in the README.

## Decisions and Trade-offs

### Structure and responsibilities

- **Keep the starter stack.** Retained the existing pnpm/Turbo workspace, React Router and TypeScript rather than adding another framework or a separate API service. Route loaders and actions adapt HTTP requests to use cases. A small Node server wires dependencies, supplies the real socket address and runs in both development and production.
- **Use pragmatic DDD boundaries.** `libs/engine` owns domain objects and application use cases; its infrastructure folder implements the repository using Prisma. `applications/web` owns HTTP handling and the interface, separated into `server` and `frontend`. The domain and use cases do not depend on React Router or Prisma. Repository, clock and code-generation dependencies are explicit, making failure paths testable without a dependency-injection framework.
- **Keep contracts and validation close to their owners.** Interfaces live in module-level `contracts` folders rather than a global collection. Named validators replace repeated conditions, while value objects enforce domain invariants. Custom errors and their messages have dedicated folders; HTTP status mapping stays in the web adapter. No `shared` or general-purpose `utils` package was introduced without a concrete need.

### Persistence and redirect correctness

- **Choose SQLite with Prisma.** A file database provides persistence and migrations without requiring another service to run the challenge. The schema stores the code, original URL, creation date and click count. The repository contract keeps storage details out of use cases. SQLite and its synchronous native driver suit this small deployment; higher write concurrency would require revisiting the storage choice.
- **Make uniqueness a database guarantee.** Generate eight alphanumeric characters with Node's cryptographic `randomInt`. Randomness reduces collision probability, but the code primary key is the final safeguard. Allow at most five code-generation attempts, retrying only code collisions and never overwriting an existing link. Other storage failures are not treated as collisions.
- **Validate destinations at the domain boundary.** Accept absolute HTTP(S) URLs up to 2,048 characters, trim surrounding whitespace and reject credentials and control characters. Preserve the accepted destination in storage and serialize it with `URL.href` for the redirect header so Unicode domains, paths and queries work correctly. URL validation does not establish that a destination is trustworthy.
- **Await atomic click recording and preserve redirects on recording failure.** GET requests wait for a database increment to avoid an unobserved background write. The default recording deadline is 1,000 ms and SQLite lock waits are limited to 250 ms. A recording failure is reported and the resolved redirect still proceeds. The deadline depends on the event loop because the driver is synchronous, and a timed-out write may still commit. Counts represent recorded requests, including bots and repeats, rather than unique visitors or confirmed destination views.
- **Use explicit HTTP semantics.** Creation returns 201 only after persistence succeeds. GET redirects use 302 and `Cache-Control: no-store` so cached permanent redirects do not bypass recording. HEAD resolves the same destination without incrementing. Validation, missing links, unsupported methods, oversized forms, rate limits and storage failures produce distinct HTTP responses; internal storage details are not exposed to users.

### Abuse protection and interface

- **Bound creation requests.** A fixed-window limiter allows ten attempts per minute per socket IP by default, including invalid attempts. It returns 429 with `Retry-After` and caps tracked clients at 10,000. Forwarded headers are ignored to avoid accepting a spoofed identity. A 32 KiB limit is enforced while reading the body, before form parsing, including requests without `Content-Length`. The limiter is local to one process and resets on restart; proxy trust and distributed quotas remain deployment concerns.
- **Keep the interface small and explicit.** Use semantic HTML and reusable React components with SCSS/BEM instead of adding a component library for a small screen. Each component owns `ComponentName.tsx` and `styles/index.scss`; global styles and colour tokens remain centralized. The final design uses a warm neutral background, violet accents and dark rounded buttons, without decorative borders or shadows. The URL field uses a grey border on hover and violet on focus. Forms retain invalid input and prevent repeated submissions while pending; clipboard rejection offers a selected manual-copy field. Copy buttons reserve enough width for all labels to prevent layout shifts. Statistics update on page reload, without a separate refresh control. The list is intentionally shared and has no ownership or pagination.

### Verification and delivery

- **Test behaviour and failures at the appropriate boundary.** Vitest covers domain rules, use cases, HTTP handling and real SQLite integration. Playwright covers browser flows and two raw HTTP body-limit cases. Tests use temporary databases rather than development data. Dependency failures, collisions, lock contention, Unicode redirects and clipboard rejection are included. TypeScript checks and Prettier support maintainability alongside these behavioural checks.
- **Make Docker the reproducible delivery path.** Pin Node 22 and pnpm, install the native SQLite dependency inside Linux, generate Prisma during the build and deploy migrations before listening. Run as a non-root user and store the database in a named volume so container recreation preserves links and counters. Validate configuration and database access at startup; use an explicit public origin instead of deriving links from request headers. Retain the Prisma CLI for startup migrations, accepting a larger image for a simpler launch. Declare generated Prisma and route types as Turbo outputs so cache hits restore required files; changes to the shared TypeScript configuration invalidate the cache.

## Verification

The 179 automated Node tests and type checking passed locally and inside Docker. The eight Playwright cases (six Chromium journeys and two HTTP checks) passed locally against a production build with temporary SQLite storage. The latest interface was also checked at desktop and mobile widths, including stable copy-button layout during copying and after success.

Docker was verified on Linux ARM64, including migrations, non-root volume access, redirects and persistence after container recreation. Cache restoration was checked after deleting generated files in a disposable container. Other architectures have not been tested.

## What I Would Do With More Time

- Automate Docker build and HTTP smoke checks in CI.
- For a public deployment, add pagination, link ownership/access control, a shared rate limiter and an explicit trusted-proxy policy. The current list is a shared demo and the limiter belongs to one process.
- Improve abuse reporting and operational visibility. Recorded clicks include bots and repeat requests; they are not unique visitors or guaranteed destination views.

## AI Usage

I used Codex throughout the challenge. Before implementation, we reviewed the existing code, analysed each requirement and defined a plan covering what to change, why and in which order. This helped establish priorities and keep the work focused on the agreed scope.

## Feedback

Working from an existing implementation made this a useful exercise in understanding a codebase, identifying its weaknesses and deciding where changes would have the most impact. The small product scope leaves room to discuss meaningful engineering decisions: protecting data integrity, separating responsibilities, handling failures and making the application reproducible to run and verify. I also appreciated that the brief includes both the user experience and delivery requirements, since these are part of making a feature complete.

One improvement would be to clarify the expected meaning of a click and the intended deployment scale. Whether statistics should include repeat requests or bots, and whether the service is expected to run as a single instance, affects several design choices. Keeping the implementation approach open while making those expectations explicit would help candidates explain their priorities and trade-offs within the time limit.
