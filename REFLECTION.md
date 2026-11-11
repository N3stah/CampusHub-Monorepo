# CampusHub Capstone Reflection

## Challenges

The most disruptive backend issue was an import failure around `PasswordResetOTP`: account recovery code imported a model that had not yet been added. Fixing the import required reconciling the model, URLs, and two diverging account migration branches. The merge migration restored a usable graph, but the duplicate numbering made it clear that migration ownership and review need to be more deliberate.

The project also showed that AI-generated code is a starting point, not verified implementation. A small mismatch between the OTP view and the model API caused server errors, while mail behavior depended on machine-specific environment configuration. Tests and a deterministic test settings module exposed those issues before another deployment. Working across two developers also required extra coordination when frontend routes and backend endpoints changed at different times.

## Trade-offs

We used plain Django views, handwritten JSON parsing, and manual serializers instead of Django REST Framework. That gave us direct control over validation and response shapes and helped us understand the request lifecycle, but it required us to implement and test common behavior ourselves.

We kept both token-based password reset and one-time email OTP recovery. The legacy token flow is simple, while OTP better supports the account onboarding and forgotten-password experience; supporting both adds maintenance and documentation overhead. We chose a monorepo for a single capstone submission and easier cross-stack review, even though separate backend and frontend repositories can support independent release cycles.

## What I Would Do Differently

I would establish migration numbering and ownership rules before parallel development, run migration graph and clean-database checks in CI, and require every feature branch to include endpoint and authorization tests. I would also agree on an API contract before frontend work begins, then use a shared checklist to catch route and response changes early.

Finally, I would review generated code line by line, run the focused tests immediately, and treat deployment configuration as part of the test design. A CI pipeline for system checks, migration drift, coverage, and frontend type checks would have caught the import, route, and environment-dependent test issues sooner. Before defense, I would also rehearse the demo against the deployed services and prepare a slide deck that explains the schema, role boundaries, service responsibilities, and known limitations.
