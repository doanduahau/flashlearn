# ENGINEERING_STANDARDS.md

> Universal Engineering Standards for Production-Grade Software
> Version: 1.0
> Scope: Technology-agnostic software engineering standards for projects from inception to real-world production operation.

---

## 0. Purpose

This document defines the baseline engineering standards that all contributors, developers, coding agents, automation agents, reviewers, and maintainers MUST follow when working on this project.

The objective is not merely to make software that "works". The objective is to create software that is:

- correct,
- understandable,
- maintainable,
- secure,
- testable,
- observable,
- scalable where required,
- resilient to failure,
- deployable safely,
- recoverable,
- operable over time,
- and adaptable to future change.

These standards are intentionally technology-agnostic.

They apply whether the project uses:

- web, mobile, desktop, embedded, backend, frontend, CLI, API, distributed systems, data systems, AI systems, or mixed architectures;
- JavaScript, TypeScript, Python, Java, Kotlin, Swift, C#, Go, Rust, C/C++, or another language;
- SQL, NoSQL, file storage, object storage, distributed databases, or embedded databases;
- monoliths, modular monoliths, microservices, event-driven architectures, serverless, mobile applications, edge systems, or other deployment models.

Specific technologies, frameworks, libraries, cloud providers, and architectural patterns are implementation choices, not universal standards.

---

# 1. Normative Language

The following terms are used throughout this document:

- **MUST**: mandatory unless a documented and approved exception exists.
- **MUST NOT**: prohibited unless a documented and approved exception exists.
- **SHOULD**: strongly recommended; deviations require a clear reason.
- **SHOULD NOT**: generally avoid unless there is a justified reason.
- **MAY**: optional and context-dependent.

When two rules appear to conflict, prioritize in this order:

1. Safety and security
2. Data integrity
3. Correctness
4. Backward compatibility
5. Reliability
6. Maintainability
7. Performance
8. Developer convenience

---

# 2. Core Engineering Philosophy

All engineering work MUST follow these principles.

## 2.1 Correctness before cleverness

Code MUST prioritize correctness and clarity over brevity, novelty, or sophistication.

Prefer:

- explicit intent,
- understandable control flow,
- meaningful names,
- predictable behavior,
- testable design.

Avoid:

- unnecessary metaprogramming,
- clever one-liners,
- obscure abstractions,
- hidden side effects,
- premature optimization.

---

## 2.2 Clarity over compactness

Shorter code is not automatically better code.

A slightly longer implementation is preferable when it:

- expresses domain meaning,
- makes failure cases explicit,
- improves reviewability,
- reduces cognitive load,
- prevents misuse.

---

## 2.3 Simplicity over unnecessary abstraction

The system MUST use the simplest design that satisfies current requirements and known near-term constraints.

Do not introduce:

- generic frameworks,
- unnecessary layers,
- plugin systems,
- factories,
- strategy hierarchies,
- distributed architecture,
- complex dependency injection,
- microservices,

unless there is a concrete requirement that justifies them.

Small duplication MAY be preferable to an incorrect abstraction.

---

## 2.4 Change should be localized

The architecture SHOULD minimize the number of unrelated areas that must change for one business requirement.

A good change should usually affect:

- the owning feature/module,
- its contract,
- its tests,
- and only necessary integration points.

If a small feature change requires modifications throughout unrelated areas, the architecture SHOULD be reviewed.

---

## 2.5 Explicit boundaries

Every meaningful system boundary SHOULD have:

- defined ownership,
- inputs,
- outputs,
- error behavior,
- validation,
- invariants,
- compatibility expectations.

Boundaries include:

- functions,
- modules,
- packages,
- services,
- APIs,
- queues,
- database schemas,
- files,
- external integrations,
- hardware interfaces.

---

## 2.6 Design for failure

External systems, networks, users, data, storage, processes, devices, dependencies, and infrastructure can fail.

Production code MUST NOT assume that:

- network calls always succeed,
- data is always valid,
- dependencies always respond,
- operations execute only once,
- requests arrive in order,
- writes never partially fail,
- processes never restart,
- users behave correctly,
- clocks are perfectly synchronized.

---

## 2.7 Secure by design

Security MUST be considered during requirements, architecture, implementation, testing, deployment, and operation.

Security MUST NOT be treated as a final-stage patch.

---

## 2.8 Observability is part of the product

A production system MUST be diagnosable.

The team SHOULD be able to determine:

- what happened,
- when it happened,
- where it happened,
- which request/job/user/entity was affected,
- what the impact was,
- what caused the failure.

---

## 2.9 Recovery must be designed before failure

A backup strategy is incomplete until restoration is tested.

Every critical system MUST define how it recovers from:

- corrupted data,
- failed deployments,
- accidental deletion,
- unavailable dependencies,
- infrastructure loss,
- compromised credentials,
- operator mistakes.

---

## 2.10 Technology is a means, not a goal

Do not select technology because it is:

- popular,
- fashionable,
- "enterprise",
- "cloud native",
- new,
- used by a large company.

Select technology based on:

- requirements,
- operational constraints,
- team capability,
- lifecycle cost,
- security,
- reliability,
- performance,
- maintainability,
- reversibility.

---

# 3. Risk-Based Tailoring

These standards apply universally, but not every control needs the same implementation depth for every project.

Before implementation, classify the system by risk.

Consider:

- number of users,
- criticality,
- data sensitivity,
- financial impact,
- availability requirements,
- legal/compliance requirements,
- irreversible actions,
- public exposure,
- dependency complexity,
- operational complexity.

Examples:

A local calculator application may not need distributed tracing.

A payment system may require:

- stronger audit logs,
- stricter authorization,
- idempotency,
- transaction guarantees,
- reconciliation,
- stronger recovery objectives.

A static website may not need a job queue.

A high-volume distributed system may.

The correct rule is:

> Apply universal engineering principles, then choose controls proportional to actual risk and requirements.

---

# 4. Software Lifecycle Standard

Every project SHOULD be treated as a lifecycle:

```text
Problem
  ↓
Requirements
  ↓
Architecture
  ↓
Implementation
  ↓
Verification
  ↓
Release
  ↓
Production
  ↓
Observation
  ↓
Maintenance
  ↓
Incident / Recovery
  ↓
Evolution
```

Agents MUST NOT treat implementation as the entire engineering process.

---

# 5. Phase 0 — Project Inception

Before implementing major functionality, establish the project's engineering foundation.

## 5.1 Define the problem

The project SHOULD document:

- user problem,
- target users,
- system goals,
- out-of-scope items,
- key business rules,
- known constraints,
- assumptions.

Do not build major architecture around undocumented assumptions.

---

## 5.2 Define success

Important functionality SHOULD have measurable acceptance criteria.

Where relevant, define:

- expected behavior,
- failure behavior,
- latency targets,
- throughput targets,
- availability targets,
- data retention,
- privacy constraints,
- security constraints,
- recovery targets.

---

## 5.3 Identify quality attributes

At minimum, evaluate:

- functional correctness,
- reliability,
- security,
- maintainability,
- performance,
- scalability,
- usability,
- accessibility where applicable,
- compatibility,
- portability,
- observability,
- recoverability.

---

## 5.4 Identify risks early

Record known high-impact risks such as:

- irreversible data loss,
- payment errors,
- privilege escalation,
- dependency lock-in,
- expensive operations,
- third-party outages,
- migration complexity,
- legal constraints.

High-risk areas SHOULD receive stronger review and testing.

---

# 6. Architecture Standards

## 6.1 Architecture must follow requirements

Do not start with:

- microservices,
- Kubernetes,
- event sourcing,
- serverless,
- clean architecture,
- a specific database,

unless requirements justify them.

Architecture MUST emerge from system constraints.

---

## 6.2 Separation of concerns

Different responsibilities SHOULD be separated where doing so reduces complexity.

Typical concerns include:

- presentation,
- business/domain logic,
- persistence,
- external integrations,
- validation,
- infrastructure,
- security,
- orchestration.

This does not require a particular folder structure.

---

## 6.3 High cohesion

A module SHOULD contain responsibilities that belong together.

A module that handles unrelated concerns SHOULD be decomposed.

---

## 6.4 Low coupling

Modules SHOULD depend on the minimum necessary knowledge of other modules.

Avoid:

- shared mutable global state,
- cross-module database writes without ownership,
- circular dependencies,
- hidden dependencies,
- direct access to unrelated internals.

---

## 6.5 Clear ownership

Important capabilities SHOULD have an identifiable owner.

Examples:

- authentication,
- payments,
- study sessions,
- notifications,
- device communication,
- document generation.

Other parts of the system SHOULD interact through the owning module's public contract.

---

## 6.6 Stable contracts

Public contracts SHOULD change deliberately.

Breaking changes MUST be:

- identified,
- documented,
- migrated safely,
- versioned where appropriate.

---

## 6.7 Dependency direction

Dependencies SHOULD flow toward stable abstractions or stable domain behavior rather than unstable implementation details.

Do not create abstractions purely to satisfy a theoretical pattern.

---

## 6.8 Avoid god modules

A file, class, service, component, or module SHOULD NOT accumulate unrelated responsibilities.

Warning signs:

- many reasons to change,
- extremely broad dependency graph,
- mixed business/UI/storage/network logic,
- difficult isolated testing,
- frequent merge conflicts.

---

## 6.9 Architecture decisions

Important irreversible or expensive decisions SHOULD be documented.

An Architecture Decision Record SHOULD include:

- context,
- decision,
- alternatives considered,
- trade-offs,
- consequences,
- date.

---

# 7. Project Structure Standards

There is no universal directory structure.

A valid structure MUST make ownership and boundaries understandable.

The codebase SHOULD make it easy to answer:

- Where does this feature live?
- Where is its business logic?
- Where is its validation?
- Where is persistence handled?
- Where are its tests?
- Where are cross-cutting infrastructure concerns?
- What is public versus internal?

Prefer grouping that supports change locality.

For larger systems, feature/domain-oriented organization is often preferable to a single global folder containing hundreds of unrelated files.

The project SHOULD avoid uncontrolled accumulation in generic buckets such as:

- `utils`,
- `helpers`,
- `common`,
- `misc`,
- `services`.

Shared code MUST have a clear reason to be shared.

---

# 8. Source Code Standards

## 8.1 Naming

Names MUST express meaning.

Prefer names based on domain behavior.

Avoid:

- meaningless abbreviations,
- `data`,
- `thing`,
- `handler2`,
- `processData`,
- `doStuff`,
- `tmp` outside narrow temporary scope.

---

## 8.2 Functions

Functions SHOULD:

- have one coherent responsibility,
- expose clear inputs and outputs,
- minimize hidden state,
- make side effects obvious,
- keep control flow understandable.

---

## 8.3 Side effects

Side effects SHOULD occur at explicit boundaries.

Examples:

- database writes,
- filesystem changes,
- network calls,
- device operations,
- sending messages,
- external API calls.

Pure logic SHOULD remain independently testable where practical.

---

## 8.4 Business logic

Business rules SHOULD NOT be duplicated across multiple interfaces.

One business rule SHOULD have one authoritative implementation or source of truth.

Presentation code SHOULD NOT become the primary holder of business logic.

---

## 8.5 Type safety

Where the language supports static types, important domain behavior SHOULD use them.

Avoid bypassing type systems with:

- `any`,
- unchecked casts,
- generic dictionaries,
- unvalidated deserialization,

unless technically necessary and documented.

Types SHOULD encode meaningful domain constraints where practical.

Invalid states SHOULD be difficult to represent.

---

## 8.6 Nullability and absence

Absence MUST be handled explicitly.

Do not assume required data exists unless guaranteed by contract or invariant.

---

## 8.7 Constants and configuration

Avoid unexplained magic values.

Business constants SHOULD have meaningful names.

Environment-specific values SHOULD be configurable.

Secrets MUST NOT be stored as source constants.

---

## 8.8 Comments

Comments SHOULD explain:

- why,
- constraints,
- non-obvious trade-offs,
- compatibility reasons,
- workarounds.

Comments SHOULD NOT merely repeat what the code already says.

---

## 8.9 Dead code

Unused code SHOULD be removed.

Do not preserve obsolete code "just in case" when version control already retains history.

---

## 8.10 Generated code

Generated code SHOULD be clearly identified.

Hand edits to generated files SHOULD be avoided unless explicitly supported.

---

# 9. Configuration Management

Configuration SHOULD be:

- explicit,
- validated,
- environment-aware,
- centrally discoverable.

The system MUST fail clearly when required configuration is missing or invalid.

Do not silently fall back to unsafe production defaults.

Separate environments SHOULD use separate credentials and configuration where appropriate.

---

# 10. Data Engineering Standards

## 10.1 Data ownership

Important data SHOULD have clearly defined ownership.

Avoid multiple unrelated modules writing the same data without coordination.

---

## 10.2 Integrity

The system MUST preserve data invariants.

Where multiple writes form one logical operation, design for:

- atomicity,
- transactionality,
- compensation,
- idempotency,
- reconciliation,

as appropriate.

---

## 10.3 Concurrency

Concurrent operations MUST be considered for mutable shared state.

Potential problems include:

- lost updates,
- duplicate creation,
- overselling,
- double payment,
- stale writes,
- ordering problems.

Use appropriate mechanisms such as:

- atomic operations,
- constraints,
- transactions,
- optimistic concurrency,
- locking,
- idempotency,
- serialization,

depending on the system.

---

## 10.4 Schema evolution

Data schemas MUST evolve through controlled, reproducible migrations.

Avoid undocumented manual production schema changes.

Migration plans SHOULD consider:

- backward compatibility,
- mixed-version deployments,
- large data volumes,
- rollback,
- backfill,
- lock duration,
- production load.

---

## 10.5 Destructive migrations

Destructive changes SHOULD use staged migration where possible.

Preferred pattern:

```text
Expand
  ↓
Migrate
  ↓
Verify
  ↓
Switch usage
  ↓
Contract
```

---

## 10.6 Data retention

Data SHOULD NOT be retained indefinitely without reason.

Where applicable, define:

- retention duration,
- archival policy,
- deletion policy,
- legal requirements,
- user deletion requirements.

---

# 11. Interface and API Standards

Every interface MUST define its contract.

Contracts SHOULD specify:

- accepted inputs,
- required fields,
- optional fields,
- response shape,
- error behavior,
- side effects,
- authorization,
- idempotency expectations,
- timeout behavior,
- compatibility.

This applies to:

- APIs,
- functions,
- events,
- messages,
- files,
- protocols,
- plugin interfaces,
- device communication.

---

## 11.1 Input validation

All data crossing a trust boundary MUST be validated.

Never assume that data from:

- users,
- browsers,
- mobile clients,
- external APIs,
- messages,
- files,
- databases,
- environment variables,
- webhooks,
- devices,

is safe or structurally correct.

---

## 11.2 Error contracts

Errors SHOULD be:

- structured,
- meaningful,
- stable enough for callers,
- safe to expose.

Internal implementation details MUST NOT leak to untrusted clients.

---

## 11.3 Compatibility

Public interfaces SHOULD consider compatibility.

Breaking changes SHOULD be avoided unless justified.

When necessary, use:

- versioning,
- migration periods,
- compatibility layers,
- deprecation.

---

# 12. Security Standards

## 12.1 Security by design

Threats MUST be considered before release.

For meaningful systems, identify:

- assets,
- actors,
- trust boundaries,
- attack surfaces,
- misuse cases,
- privileged operations.

---

## 12.2 Least privilege

Users, services, processes, agents, and credentials MUST have only the permissions required.

Avoid broad administrator privileges by default.

---

## 12.3 Authentication

Identity MUST be verified where access depends on who the actor is.

Authentication mechanisms SHOULD use established, reviewed implementations.

Avoid custom cryptography or custom authentication protocols unless required and reviewed by specialists.

---

## 12.4 Authorization

Authorization MUST be enforced at trusted boundaries.

UI visibility MUST NOT be considered an authorization control.

For sensitive operations verify:

- actor,
- target resource,
- requested action,
- ownership/role/policy.

---

## 12.5 Trust boundaries

Every crossing from less trusted to more trusted context SHOULD be treated explicitly.

Examples:

- public network → backend,
- frontend → server,
- plugin → host,
- third party → internal service,
- user upload → processing pipeline.

---

## 12.6 Secrets

Secrets MUST NOT be:

- committed to source control,
- logged,
- embedded in client-accessible bundles,
- shared unnecessarily,
- stored in plain text when secure storage is available.

Secrets SHOULD support:

- rotation,
- revocation,
- scoped permissions,
- environment separation.

---

## 12.7 Cryptography

Use established algorithms and libraries.

Do not invent cryptographic schemes.

Sensitive information SHOULD be encrypted in transit and at rest when risk justifies it.

---

## 12.8 Sensitive actions

High-impact actions SHOULD require stronger protection.

Examples:

- deleting accounts,
- changing permissions,
- payments,
- exporting sensitive data,
- modifying security settings,
- administrative actions.

Controls MAY include:

- re-authentication,
- step-up authentication,
- confirmation,
- multi-party approval,
- audit trail.

---

## 12.9 Rate limiting and abuse protection

Public or expensive operations SHOULD be protected against abuse.

Consider:

- brute force,
- scraping,
- automated spam,
- resource exhaustion,
- denial-of-service patterns,
- cost amplification.

---

## 12.10 File handling

User-supplied files SHOULD be treated as untrusted.

Consider:

- file type validation,
- size limits,
- malware risks,
- path traversal,
- decompression bombs,
- metadata exposure,
- unsafe rendering,
- executable content.

---

# 13. Privacy Standards

Security and privacy are separate concerns.

Projects processing personal or sensitive information SHOULD define:

- what is collected,
- why it is collected,
- where it is stored,
- who can access it,
- how long it is retained,
- how it is deleted,
- how it is exported,
- what third parties receive it.

Collect the minimum data required for the product's legitimate purpose.

Avoid collecting sensitive data "for future use" without justification.

---

# 14. Dependency and Supply Chain Standards

Dependencies create operational and security risk.

Before adding a dependency, evaluate:

- necessity,
- maintenance activity,
- license,
- security history,
- ecosystem maturity,
- transitive dependency cost,
- replacement difficulty,
- bundle/runtime impact.

Prefer fewer well-understood dependencies over many convenience packages.

---

## 14.1 Lock dependencies

Projects SHOULD use supported dependency locking or deterministic resolution mechanisms.

---

## 14.2 Vulnerability management

Dependencies SHOULD be monitored for known security vulnerabilities.

Critical vulnerabilities SHOULD have a defined remediation process.

---

## 14.3 Build integrity

Build systems SHOULD be:

- reproducible where practical,
- auditable,
- protected from unauthorized changes,
- traceable to source versions.

Artifacts SHOULD be identifiable by version or immutable identifier.

---

## 14.4 AI-generated code

AI-generated code MUST be treated as untrusted until reviewed and verified.

Agents MUST NOT assume generated code is:

- correct,
- secure,
- compatible,
- performant,
- legally appropriate.

AI-generated code is subject to the same standards as human-written code.

---

# 15. Testing and Verification Standards

Testing depth MUST be proportional to risk.

The project SHOULD use a combination of:

- static analysis,
- formatting,
- linting,
- type checking,
- unit tests,
- integration tests,
- system tests,
- end-to-end tests,
- security tests,
- performance tests,
- fault/recovery tests,

as appropriate.

---

## 15.1 Test behavior, not implementation details

Tests SHOULD focus on observable behavior and contracts.

Avoid tests that break unnecessarily because internal structure changed.

---

## 15.2 Critical business rules

Critical business rules MUST have automated verification where practical.

Examples:

- money calculations,
- authorization,
- state transitions,
- limits,
- eligibility,
- scoring,
- data transformations.

---

## 15.3 Regression tests

A significant bug fix SHOULD include a regression test that fails before the fix and passes after it.

---

## 15.4 Edge cases

Tests SHOULD cover relevant:

- empty state,
- maximum/minimum values,
- invalid input,
- duplicate input,
- missing dependencies,
- timeouts,
- partial failures,
- concurrency,
- authorization boundaries.

---

## 15.5 Test independence

Tests SHOULD avoid unnecessary dependence on:

- execution order,
- shared mutable state,
- real external services,
- local developer state.

---

## 15.6 Coverage

Coverage is a diagnostic metric, not a quality target by itself.

High test coverage MUST NOT be used as a substitute for meaningful verification.

---

# 16. Performance Standards

Performance requirements MUST be measurable when performance matters.

Define targets such as:

- latency,
- throughput,
- memory,
- CPU,
- startup time,
- storage,
- network usage,
- battery usage,
- frame rate,

depending on product type.

Do not optimize without evidence.

Prefer:

```text
Measure
  ↓
Profile
  ↓
Identify bottleneck
  ↓
Optimize
  ↓
Measure again
```

---

# 17. Scalability Standards

Scalability MUST be evaluated against actual growth dimensions.

Potential dimensions:

- concurrent users,
- requests,
- data volume,
- geographic regions,
- tenants,
- messages,
- jobs,
- files,
- devices,
- compute workload,
- team size.

Do not introduce distributed complexity before it is justified.

---

## 17.1 Scale bottlenecks

Identify likely limits:

- CPU,
- memory,
- database,
- network,
- storage,
- connection count,
- external service quotas,
- queue backlog,
- lock contention.

---

## 17.2 Statelessness

Components intended to scale horizontally SHOULD avoid storing irreplaceable state in local process memory.

Persistent or shared state SHOULD live in appropriate durable systems.

---

## 17.3 Caching

Caching SHOULD be introduced only with:

- measurable benefit,
- defined ownership,
- invalidation strategy,
- consistency expectations,
- failure behavior.

Cache is not a source of truth unless explicitly designed as one.

---

## 17.4 Background work

Long-running or retryable work SHOULD be moved out of latency-sensitive request paths when appropriate.

Queued work SHOULD consider:

- retries,
- duplicate delivery,
- ordering,
- idempotency,
- poison jobs,
- failure visibility.

---

# 18. Reliability and Resilience Standards

## 18.1 Timeouts

Remote operations MUST have bounded wait time where hanging indefinitely is possible.

---

## 18.2 Retries

Retries MUST be deliberate.

Before retrying, consider:

- whether the failure is transient,
- whether the operation is safe to repeat,
- whether idempotency exists,
- whether retries can amplify outages.

Use bounded retry strategies.

---

## 18.3 Backoff

Repeated retries SHOULD use backoff and jitter where appropriate to avoid synchronized retry storms.

---

## 18.4 Idempotency

Operations vulnerable to duplicate execution SHOULD be idempotent or otherwise protected.

Examples:

- payments,
- order creation,
- message processing,
- webhook processing,
- job execution,
- account creation.

---

## 18.5 Graceful degradation

Failure of a non-critical subsystem SHOULD NOT necessarily make the entire product unavailable.

Systems SHOULD define which features are:

- essential,
- degradable,
- optional.

---

## 18.6 Failure isolation

Architectures SHOULD limit cascading failures.

Possible techniques include:

- resource limits,
- separate pools,
- queues,
- bulkheads,
- circuit breakers,
- dependency isolation.

Use only where justified.

---

## 18.7 Graceful shutdown

Processes SHOULD shut down safely.

Where relevant:

- stop accepting new work,
- finish or safely abandon active work,
- flush buffers,
- release locks,
- close connections,
- preserve job state.

---

# 19. Observability Standards

Production systems MUST provide enough telemetry to diagnose meaningful failures.

The observability strategy SHOULD consider:

- logs,
- metrics,
- traces,
- events,
- audit records.

Not every project requires all forms.

---

## 19.1 Structured logging

Important logs SHOULD contain structured context.

Useful context may include:

- timestamp,
- severity,
- request ID,
- trace ID,
- job ID,
- user/entity ID where safe,
- component,
- error code,
- duration.

---

## 19.2 Correlation

Distributed or asynchronous workflows SHOULD support correlation between related operations.

---

## 19.3 Sensitive logging

Logs MUST NOT expose:

- passwords,
- tokens,
- private keys,
- secrets,
- unnecessary personal data.

---

## 19.4 Metrics

Systems SHOULD measure signals relevant to user impact.

Common categories:

- traffic,
- error rate,
- latency,
- saturation,
- queue depth,
- resource exhaustion,
- business-critical failure rates.

---

## 19.5 Alerting

Alerts SHOULD be actionable.

Avoid alerts that:

- fire constantly,
- have no owner,
- have no response procedure,
- measure meaningless thresholds.

Alert on symptoms with user or operational impact.

---

# 20. Deployment Standards

## 20.1 Version control

Production changes MUST be version-controlled.

---

## 20.2 Reviewability

Changes SHOULD be small enough to review and reason about.

Avoid combining unrelated:

- refactors,
- feature work,
- dependency upgrades,
- formatting changes,
- schema changes,

in a single change set.

---

## 20.3 Automated checks

Before production deployment, appropriate automated checks SHOULD run.

Examples:

- format,
- lint,
- typecheck,
- tests,
- security scanning,
- build,
- schema verification,
- package verification.

---

## 20.4 Environment separation

Projects SHOULD separate environments appropriate to their risk.

Common environments:

- local/development,
- test,
- staging,
- production.

Production SHOULD NOT be used as the primary testing environment.

---

## 20.5 Release identity

Every deployment SHOULD be traceable to:

- source revision,
- artifact version,
- migration version,
- deployment time.

---

## 20.6 Rollback or roll-forward

Every production change SHOULD have a failure recovery strategy.

Depending on system design:

- rollback code,
- roll forward,
- disable feature,
- revert configuration,
- restore data.

Do not assume code rollback automatically rolls back data safely.

---

## 20.7 Progressive delivery

High-risk changes SHOULD consider controlled rollout.

Examples:

- internal users,
- percentage rollout,
- region rollout,
- canary,
- feature flags.

Feature flags SHOULD have:

- owner,
- purpose,
- lifecycle,
- removal plan.

---

# 21. Database and Storage Deployment

Schema changes MUST be coordinated with deployed software.

Avoid changes that make the previous version immediately incompatible where zero-downtime or rollback is required.

Large migrations SHOULD be tested with realistic data volume.

Backup SHOULD be verified before destructive operations.

---

# 22. Operational Readiness

Before first real users, the project SHOULD answer:

- Who owns production?
- How are incidents detected?
- Where are logs?
- Where are metrics?
- How is deployment performed?
- How is rollback performed?
- How are secrets rotated?
- How is the database restored?
- What happens when a dependency is unavailable?
- Who has production access?
- How are access rights revoked?

---

# 23. Documentation Standards

Documentation MUST explain information that cannot be reliably inferred from code.

Important documentation MAY include:

- system overview,
- architecture,
- setup,
- deployment,
- environment configuration,
- data model,
- public contracts,
- security assumptions,
- operational procedures,
- incident procedures,
- architectural decisions.

Documentation SHOULD be maintained with the system.

Outdated documentation is a defect.

---

# 24. Debugging and Bug-Fix Standard

Bug fixing MUST follow a disciplined process.

## Required workflow

```text
1. Reproduce
2. Determine scope and impact
3. Identify root cause
4. Define expected behavior
5. Add regression test where practical
6. Implement smallest safe fix
7. Run affected tests
8. Run broader quality checks
9. Review diff
10. Deploy safely
11. Observe production behavior
12. Document significant lessons
```

---

## 24.1 Fix root cause

Do not stop at symptom suppression unless the action is an emergency containment measure.

Example:

Disabling a button may reduce duplicate requests.

The root cause may still require:

- idempotency,
- server-side constraint,
- concurrency protection.

---

## 24.2 Smallest safe diff

Bug fixes SHOULD minimize unrelated changes.

Avoid opportunistic refactoring during urgent fixes unless required for correctness.

---

## 24.3 Incident severity

High-impact bugs SHOULD be classified.

Severity MAY consider:

- user impact,
- security impact,
- financial impact,
- data loss,
- availability,
- affected user count.

---

# 25. Incident Management

Significant incidents SHOULD follow:

```text
Detect
  ↓
Assess
  ↓
Contain
  ↓
Communicate
  ↓
Mitigate
  ↓
Recover
  ↓
Verify
  ↓
Analyze
  ↓
Prevent recurrence
```

---

## 25.1 Incident priorities

During an incident:

1. Protect people and safety where applicable
2. Protect data
3. Stop further damage
4. Restore critical service
5. Preserve evidence
6. Diagnose root cause
7. Improve system

---

## 25.2 Post-incident review

Important incidents SHOULD have a review covering:

- timeline,
- customer impact,
- detection,
- root cause,
- contributing factors,
- why defenses failed,
- remediation actions,
- owners,
- deadlines.

Focus on system improvement, not blame.

---

# 26. Backup Standards

Every project with non-reconstructible data MUST have a backup strategy.

The strategy SHOULD identify:

- what is backed up,
- frequency,
- retention,
- storage location,
- encryption,
- access control,
- restore procedure,
- restore testing.

---

## 26.1 Backup scope

Consider:

- primary databases,
- files,
- object storage,
- configuration,
- critical metadata,
- infrastructure definitions,
- encryption key recovery,
- external business-critical data.

---

## 26.2 Independent failure domains

Critical backups SHOULD NOT depend entirely on the same failure domain as production.

Consider risks such as:

- account compromise,
- provider outage,
- accidental deletion,
- ransomware,
- operator error.

---

## 26.3 Restore testing

Backups MUST be periodically tested by restoring them.

A backup that has never been restored is not proven recoverable.

---

# 27. Recovery Objectives

Critical systems SHOULD define:

## RPO — Recovery Point Objective

Maximum acceptable amount of data loss measured in time.

Example:

```text
RPO = 15 minutes
```

---

## RTO — Recovery Time Objective

Maximum acceptable time to restore service.

Example:

```text
RTO = 1 hour
```

Backup and disaster recovery architecture SHOULD be designed from these targets.

---

# 28. Disaster Recovery

Critical systems SHOULD have a documented disaster recovery plan.

Potential scenarios include:

- database corruption,
- cloud region outage,
- account compromise,
- expired credentials,
- accidental deletion,
- storage loss,
- DNS failure,
- dependency outage,
- malicious attack,
- failed migration.

The plan SHOULD specify:

- trigger conditions,
- responsibilities,
- recovery steps,
- dependencies,
- verification,
- communication.

---

# 29. Runbooks

Operationally important procedures SHOULD have runbooks.

Examples:

- production rollback,
- database restore,
- secret rotation,
- dependency outage,
- queue backlog,
- elevated error rate,
- high latency,
- failed deployment,
- compromised credential response.

Runbooks SHOULD be:

- tested,
- concise,
- current,
- executable by someone other than the original author.

---

# 30. Access Control for Operations

Production access SHOULD follow least privilege.

Prefer:

- role-based access,
- temporary elevated access,
- read-only access for debugging,
- audited administrative actions.

Avoid permanent shared administrator credentials.

Access SHOULD be revoked promptly when no longer required.

---

# 31. Auditability

Sensitive business or administrative actions SHOULD have audit records where risk justifies it.

An audit record MAY include:

- actor,
- action,
- target,
- timestamp,
- previous value,
- new value,
- request/trace identifier.

Audit records SHOULD be tamper-resistant enough for their purpose.

---

# 32. Accessibility and User Experience Quality

User-facing systems SHOULD consider accessibility and inclusive design appropriate to their platform.

Relevant aspects may include:

- keyboard navigation,
- screen readers,
- contrast,
- text scaling,
- focus states,
- semantic structure,
- touch target sizes,
- motion sensitivity,
- localization.

User experience MUST include failure states, not only the happy path.

Relevant UI states include:

- loading,
- empty,
- error,
- offline,
- permission denied,
- retry,
- partial success,
- disabled,
- success.

---

# 33. Cost and Resource Efficiency

Engineering decisions SHOULD consider total operational cost.

Cost includes:

- infrastructure,
- third-party APIs,
- storage,
- bandwidth,
- observability,
- engineering effort,
- maintenance,
- vendor lock-in,
- migration cost.

An architecture that scales technically but is economically unsustainable is not production-ready.

---

# 34. Third-Party Integration Standards

External systems MUST be treated as unreliable dependencies.

Integrations SHOULD define:

- timeout,
- retry policy,
- failure behavior,
- rate limits,
- quota behavior,
- authentication,
- secret rotation,
- version compatibility,
- degraded mode,
- monitoring.

Critical third-party dependencies SHOULD have contingency plans where practical.

---

# 35. Time, Ordering, and Distributed Behavior

Systems relying on time or event order MUST account for:

- clock differences,
- delayed events,
- duplicate events,
- out-of-order delivery,
- retries,
- process restarts.

Do not rely on perfect global ordering unless guaranteed by the underlying system.

---

# 36. Internationalization and Localization

Products serving multiple regions SHOULD avoid unnecessary assumptions about:

- language,
- timezone,
- date formats,
- currency,
- number formats,
- name structure,
- address formats,
- character sets.

Store canonical time values appropriately and convert for presentation.

---

# 37. Legal, Licensing, and Compliance

The project SHOULD understand relevant:

- software licenses,
- content licenses,
- privacy obligations,
- data residency,
- industry regulation,
- accessibility requirements,
- export restrictions,

where applicable.

Agents MUST NOT introduce dependencies or assets with incompatible licensing without review.

---

# 38. Quality Gates

A change MUST NOT be considered complete merely because code was written.

The required quality gates depend on project tooling, but SHOULD include applicable checks.

## Gate A — Scope

- The requested requirement is implemented.
- No unrelated behavior was changed.
- No unnecessary dependency was added.
- No architecture was changed without justification.

## Gate B — Correctness

- Main path works.
- Error paths are handled.
- Edge cases were considered.
- Business invariants are preserved.

## Gate C — Security

- Authorization remains enforced.
- Input boundaries are validated.
- No secrets are exposed.
- No obvious attack surface was introduced.
- Sensitive data handling remains appropriate.

## Gate D — Data

- Schema changes are safe.
- Data migration is accounted for.
- Concurrent writes are safe where relevant.
- Partial failures do not corrupt state.

## Gate E — Tests

- Relevant existing tests pass.
- New tests exist where behavior changed.
- Regression tests exist for meaningful bug fixes.

## Gate F — Static Quality

Run available project checks such as:

```text
format
lint
typecheck
static analysis
build
```

## Gate G — Deployment

- Deployment requirements are identified.
- Configuration changes are documented.
- Migration order is documented.
- Rollback/roll-forward path exists for risky changes.

## Gate H — Operations

- Logs/metrics are sufficient for critical behavior.
- New failure modes are observable.
- Runbooks are updated if operational behavior changes.

---

# 39. Definition of Done

A task is complete only when all applicable items are true.

- [ ] Requirement is satisfied.
- [ ] Scope remained controlled.
- [ ] Existing architecture and conventions were respected.
- [ ] Code is readable and maintainable.
- [ ] Business logic is not unnecessarily duplicated.
- [ ] External inputs are validated.
- [ ] Authorization and security boundaries are preserved.
- [ ] Error handling is explicit.
- [ ] Relevant edge cases are handled.
- [ ] Relevant concurrency risks are handled.
- [ ] Data integrity is preserved.
- [ ] Tests were added or updated where appropriate.
- [ ] Existing relevant tests pass.
- [ ] Static checks pass.
- [ ] Build succeeds.
- [ ] No secrets or sensitive information were introduced.
- [ ] Database migrations are safe.
- [ ] Deployment impact is documented.
- [ ] Rollback/recovery implications are understood.
- [ ] Documentation is updated where needed.
- [ ] The final diff was reviewed.
- [ ] Remaining risks or issues are reported.

---

# 40. Agent Operating Standard

All coding agents MUST behave as engineering contributors, not blind code generators.

Before making changes, the agent MUST:

1. Read relevant project instructions.
2. Inspect existing architecture and conventions.
3. Understand the requested scope.
4. Identify affected modules.
5. Identify important invariants.
6. Identify security/data/deployment implications.
7. Avoid making assumptions that can be verified from the repository.

---

## 40.1 Before implementation

The agent SHOULD determine:

- What existing behavior must remain unchanged?
- Where does this responsibility belong?
- Is there already a reusable implementation?
- What business rule is changing?
- What data is affected?
- What external interfaces are affected?
- What tests already cover this behavior?
- What can fail?
- Is the operation reversible?

---

## 40.2 During implementation

The agent MUST:

- work only within requested scope,
- follow current architecture,
- avoid unrelated refactoring,
- avoid unnecessary dependencies,
- keep changes reviewable,
- preserve backward compatibility unless change requires otherwise,
- avoid weakening security,
- preserve data integrity,
- handle errors explicitly.

---

## 40.3 Agent anti-patterns

Agents MUST NOT:

- rewrite large portions of working code without reason,
- create parallel implementations of existing systems,
- bypass validation to "make it work",
- disable security checks to fix functionality,
- use `any` or equivalent escape hatches casually,
- swallow exceptions,
- hide failing tests,
- delete tests simply because they fail,
- hard-code secrets,
- introduce dependencies for trivial functionality,
- change architecture without explaining why,
- claim success without executing available verification.

---

# 41. Agent Bug-Fixing Standard

When fixing a bug, the agent MUST:

1. Reproduce or establish the failing condition.
2. Identify the actual root cause.
3. Determine affected scope.
4. Check for similar occurrences.
5. Add or update regression coverage where practical.
6. Make the smallest safe fix.
7. Run relevant tests.
8. Run broader project checks.
9. Review the diff.
10. Report remaining uncertainty.

Do not fix only the visible symptom if the underlying correctness issue remains.

---

# 42. Agent Refactoring Standard

Refactoring MUST preserve observable behavior unless behavior change is explicitly requested.

Before refactoring:

- establish existing tests,
- define intended improvement,
- keep scope bounded.

After refactoring:

- confirm behavior is unchanged,
- run relevant tests,
- compare interfaces,
- inspect the diff.

Do not combine broad refactors with unrelated feature development.

---

# 43. Agent New-Feature Standard

For new functionality, the agent SHOULD consider:

## Functional

- happy path,
- invalid input,
- empty state,
- duplicate requests,
- missing dependencies,
- permission boundaries.

## Data

- persistence,
- migration,
- constraints,
- concurrency,
- retention.

## Security

- authentication,
- authorization,
- validation,
- secrets,
- abuse.

## Reliability

- timeout,
- retry,
- partial failure,
- idempotency.

## Operations

- logs,
- metrics,
- deployment,
- rollback,
- support/debugging.

---

# 44. Agent Database Change Standard

Before modifying persistent data structures, the agent MUST evaluate:

- compatibility with current code,
- migration strategy,
- existing data,
- rollback,
- production size,
- constraints,
- indexes,
- write locks,
- zero-downtime implications where applicable.

Never perform destructive schema changes casually.

---

# 45. Agent Security Change Standard

Changes affecting:

- identity,
- sessions,
- roles,
- permissions,
- payments,
- secrets,
- sensitive data,
- uploads,
- admin capabilities,

MUST receive stronger scrutiny.

The agent MUST report:

- trust boundary changes,
- privilege changes,
- attack surface changes,
- validation changes,
- sensitive data exposure.

---

# 46. Agent Dependency Standard

Before adding a dependency, the agent SHOULD answer:

- Why is it needed?
- Can existing project capabilities solve the problem?
- Is it actively maintained?
- Is the license acceptable?
- What transitive dependencies are introduced?
- What long-term maintenance cost is added?

Avoid dependencies for trivial helpers.

---

# 47. Agent Completion Report

At the end of work, the agent MUST report concisely:

## Changed

- files/modules changed,
- behavior added or fixed.

## Verification

- commands executed,
- tests executed,
- build/typecheck/lint status.

## Data / Configuration

- migrations,
- environment variables,
- secrets/config changes.

## Production Impact

- deployment considerations,
- compatibility,
- rollback considerations.

## Remaining Issues

- known limitations,
- unresolved risk,
- follow-up work.

Do not claim checks passed if they were not actually executed.

---

# 48. Review Standard

Code review SHOULD verify more than style.

Reviewers SHOULD examine:

- correctness,
- architecture,
- business invariants,
- security,
- concurrency,
- error handling,
- test quality,
- compatibility,
- performance implications,
- deployment,
- observability,
- recovery.

---

# 49. Change Size Standard

Prefer:

```text
small
cohesive
reviewable
reversible
testable
```

changes.

Avoid changes that mix:

```text
feature
+
refactor
+
dependency upgrade
+
format rewrite
+
schema redesign
```

unless they are inseparable.

---

# 50. Versioning and Compatibility

Systems with external consumers SHOULD define compatibility policy.

Consider:

- API versions,
- schema versions,
- mobile client versions,
- persisted data versions,
- message formats,
- plugin interfaces.

Old versions SHOULD be deprecated deliberately rather than broken accidentally.

---

# 51. Technical Debt

Technical debt SHOULD be explicit rather than hidden.

When knowingly accepting debt, document:

- reason,
- consequence,
- risk,
- trigger for cleanup.

Not all shortcuts are bad.

Undocumented shortcuts that become permanent are dangerous.

---

# 52. Modern Engineering Practices

The project SHOULD adopt modern practices when they provide measurable value.

Examples:

- secure by design,
- infrastructure reproducibility,
- automated verification,
- supply-chain integrity,
- observability,
- progressive delivery,
- least privilege,
- policy automation,
- immutable artifacts,
- controlled rollout,
- continuous dependency maintenance,
- AI-assisted development with verification.

These are principles, not mandatory vendor choices.

---

# 53. Technology Neutrality

The following statements are NOT universal truths:

```text
Microservices are better than monoliths.
Kubernetes is more enterprise than virtual machines.
NoSQL scales better than SQL.
Serverless is better than servers.
Event-driven is better than request/response.
A cloud product is always better than self-hosted.
A design pattern is always better than direct code.
```

The correct engineering decision depends on constraints and trade-offs.

---

# 54. System Quality Model

When evaluating the project, assess at least these dimensions.

## 54.1 Functional correctness

Does the system do what users and business rules require?

## 54.2 Reliability

Does it continue to behave correctly under expected failures?

## 54.3 Security

Does it protect data, capabilities, identities, and resources?

## 54.4 Maintainability

Can engineers safely understand and modify it?

## 54.5 Performance efficiency

Does it use resources efficiently enough for requirements?

## 54.6 Compatibility

Does it interact correctly with required systems and versions?

## 54.7 Usability

Can intended users successfully use it?

## 54.8 Portability

Can it be moved or adapted when required?

## 54.9 Observability

Can its behavior and failures be understood?

## 54.10 Recoverability

Can the system and its data be restored after failure?

## 54.11 Evolvability

Can requirements, technology, and scale change without unacceptable risk?

---

# 55. Production Readiness Review

Before exposing the system to real users, perform a production readiness review.

## Product

- [ ] Core user journeys work.
- [ ] Error states are usable.
- [ ] Critical user data is protected.
- [ ] User-facing limitations are understood.

## Architecture

- [ ] Boundaries are clear.
- [ ] Critical dependencies are understood.
- [ ] Major single points of failure are known.
- [ ] Capacity assumptions are documented.

## Security

- [ ] Authentication is correct where required.
- [ ] Authorization is enforced server-side/trusted-side.
- [ ] Inputs are validated.
- [ ] Secrets are protected.
- [ ] Sensitive data handling is appropriate.
- [ ] Dependency vulnerabilities have been reviewed.

## Data

- [ ] Schema is versioned.
- [ ] Constraints preserve integrity.
- [ ] Migrations are tested.
- [ ] Backup exists.
- [ ] Restore has been tested for critical systems.

## Reliability

- [ ] External calls have failure handling.
- [ ] Dangerous duplicate operations are protected.
- [ ] Critical workflows handle partial failure.
- [ ] Resource exhaustion risks are understood.

## Observability

- [ ] Important failures are logged.
- [ ] Sensitive data is not logged.
- [ ] Critical signals are monitored.
- [ ] Alerts exist where immediate action is needed.

## Deployment

- [ ] Release process is documented.
- [ ] Production artifact is identifiable.
- [ ] Configuration is validated.
- [ ] Rollback or recovery path exists.
- [ ] Dangerous migrations have recovery plans.

## Operations

- [ ] Production ownership is known.
- [ ] Runbooks exist for critical incidents.
- [ ] Production access is controlled.
- [ ] Secret rotation is possible.
- [ ] Incident communication path is known.

---

# 56. Long-Term Maintenance

A production system SHOULD have recurring maintenance processes for:

- dependency updates,
- vulnerability remediation,
- backups,
- restore tests,
- credential rotation,
- certificate renewal,
- capacity review,
- data retention,
- technical debt,
- obsolete feature removal,
- API deprecation,
- incident learnings,
- documentation updates.

---

# 57. End-of-Life

Features, APIs, systems, and services eventually reach end-of-life.

Decommissioning SHOULD consider:

- user migration,
- data export,
- data deletion,
- dependency removal,
- credential revocation,
- DNS/network cleanup,
- documentation,
- billing termination,
- retained backups.

---

# 58. Universal Engineering Checklist

Use this checklist for significant work.

## Understand

- [ ] I understand the requirement.
- [ ] I understand existing architecture.
- [ ] I identified affected modules.
- [ ] I understand business invariants.

## Design

- [ ] Responsibility is placed in the correct module.
- [ ] The design is no more complex than necessary.
- [ ] Public contracts are explicit.
- [ ] Failure behavior is defined.

## Build

- [ ] Naming is clear.
- [ ] Logic is readable.
- [ ] Business rules are not duplicated.
- [ ] Side effects are controlled.
- [ ] Configuration is not hard-coded unnecessarily.

## Security

- [ ] Trust boundaries are respected.
- [ ] Input is validated.
- [ ] Authorization is enforced.
- [ ] Secrets are protected.
- [ ] Sensitive data is handled safely.

## Data

- [ ] Data integrity is preserved.
- [ ] Concurrency is considered.
- [ ] Migration is safe.
- [ ] Destructive operations are deliberate.

## Reliability

- [ ] Failure states are handled.
- [ ] Timeouts are bounded.
- [ ] Retry behavior is safe.
- [ ] Duplicate operations are safe where necessary.
- [ ] Partial failure is understood.

## Test

- [ ] Important behavior is tested.
- [ ] Edge cases are tested where relevant.
- [ ] Regression coverage exists for significant fixes.
- [ ] Existing behavior still passes.

## Deploy

- [ ] Build/check pipeline passes.
- [ ] Configuration changes are known.
- [ ] Data migration order is known.
- [ ] Rollback/recovery is possible.

## Operate

- [ ] Failures are observable.
- [ ] Logs contain useful context.
- [ ] No sensitive information is logged.
- [ ] Monitoring is updated where needed.

## Finish

- [ ] Diff was reviewed.
- [ ] Documentation was updated.
- [ ] Known risks were reported.
- [ ] No unrelated changes remain.

---

# 59. Mandatory Agent Instruction Block

The following block MAY be reused in an agent master prompt:

```text
Read and follow ENGINEERING_STANDARDS.md before making changes.

Act as a production software engineer, not a code generator.

Before editing:
- inspect the existing architecture, conventions, relevant tests, and affected data/contracts;
- identify business invariants, trust boundaries, failure modes, compatibility concerns, and deployment impact;
- reuse existing project patterns unless there is a justified reason not to.

During implementation:
- work only within the requested scope;
- prefer simple, explicit, maintainable code;
- keep business logic in its proper owning layer/module;
- avoid duplicated business rules;
- validate untrusted inputs at system boundaries;
- preserve authentication, authorization, privacy, and data integrity;
- consider concurrency, idempotency, timeouts, retries, and partial failure where relevant;
- do not add dependencies or abstractions without concrete need;
- do not refactor unrelated code;
- do not weaken tests or security to make a task pass.

Before completing:
- run all relevant project checks available for the affected scope;
- run format/lint/typecheck/static analysis/build/tests as applicable;
- add regression coverage for meaningful bug fixes;
- inspect the final diff;
- verify migration and deployment safety;
- identify rollback/recovery implications for risky changes.

Report:
- files/modules changed;
- behavior changed;
- commands/checks executed and their results;
- migrations/configuration/environment changes;
- security/data/deployment implications;
- known limitations and remaining risks.

Never claim a check passed unless it was actually executed.
```

---

# 60. Final Principle

A production-grade engineering system is not defined by the framework it uses.

It is defined by how safely and predictably it can:

```text
Understand requirements
        ↓
Design
        ↓
Implement
        ↓
Verify
        ↓
Release
        ↓
Operate
        ↓
Detect failure
        ↓
Recover
        ↓
Evolve
```

The ultimate standard is:

> **Make the system correct enough to trust, simple enough to understand, safe enough to operate, observable enough to diagnose, recoverable enough to survive failure, and adaptable enough to remain useful as requirements change.**
