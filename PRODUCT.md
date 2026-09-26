# Product

<!-- impeccable:product-schema 1 -->

> Impeccable product record, shared by every UI surface in this repo. It is not the
> architecture document: server design rationale lives in [DESIGN.md](DESIGN.md), and
> each UI surface keeps its own visual system in its own directory (for example
> `website/DESIGN.md`). Run Impeccable with the surface directory as the working
> directory so it never reads the root architecture DESIGN.md as a visual system.

## Platform

web

## Users

Four audiences, all confirmed:

- **Platform engineers**: evaluate, deploy (Docker, Helm), configure and operate the server; read the docs and API reference.
- **Integration teams**: onboard partner EHRs (Epic, Oracle Health/Cerner, athenahealth, any FHIR R4 server), watch sync schedules, reconcile partner vs ingested data, and handle sync incidents.
- **AI app builders**: build AI features that read normalized FHIR R4 patient data out of this server.
- **Clinical and billing staff**: non-technical users working with patient data, prior authorization and billing documentation.

## Product Purpose

The **Tribe Health FHIR Server**: Tribe Health's fork of the WSO2 FHIR Server, used as an intermediate EHR for AI. It pulls patient data from partner EHRs into one FHIR R4 store (Go, PostgreSQL) so AI applications can work from a single, normalized, tenant-isolated source. Success means partner data arrives complete and current, and the people above can trust, operate and act on it.

It is the supporting platform behind Tribe Health's lead product, the **Prior Authorization Workbench** (interim public name; source `../kevin/prior-auth`), which turns a surgeon's decision and the patient chart into a cited, reviewable prior-authorization letter. Company-level product truth lives in the tribehealth.ai site's record, `../simple-ai-care/PRODUCT.md`; this file adds what is specific to the FHIR server and must not contradict it.

## Positioning

The data layer under the Prior Authorization Workbench: a single-binary, single-database FHIR R4 server (write-time search indexing in PostgreSQL, multi-tenancy with row-level security, fail-closed search) put to work as the normalization layer between partner EHRs and AI.

## Operating Context

- Server: FHIR R4 REST API (JSON, XML, Turtle), `/t/{tenant}` tenant routing, Helm and Docker deployment, health probes, Prometheus metrics, OpenTelemetry tracing.
- Partner data enters through FHIR R4 REST and Bulk Data `$export` with SMART backend-services authorization.
- Team process docs: `docs/integrations/` (onboarding), `docs/sync/` (sync runbooks), `docs/compliance/` (HIPAA), `docs/billing/` (payer documentation and prior auth).

## Capabilities and Constraints

UI surfaces:

| Surface | Status | Location |
|---|---|---|
| Documentation site | Exists (Docusaurus 3, React 19, offline search, Mermaid) | `website/`, published to GitHub Pages |
| Marketing landing page | Planned; tribehealth.ai (`../simple-ai-care`) is the company marketing site, so decide whether this becomes a section there or a separate page | Undecided |
| Admin console (tenants, search params, IGs, health) | Planned | Undecided |
| Integration dashboard (partner onboarding, sync status, reconciliation) | Planned | Undecided |

Constraints:

- **PHI:** UI mocks, fixtures, screenshots and demo data use synthetic patients only. Real PHI may only be processed on a Tribe PHI lane (ATH-D-001, `phi-lane-policy` skill). Never put real patient details, credentials or real partner endpoint hosts into a UI surface, comp or committed artifact.
- Tenant isolation is a product guarantee; a UI must never show one tenant's data in another tenant's context.
- Search is fail-closed: an unsupported query returns an error, not a wider result set. UIs surface that error honestly.
- Terminology is delegated to an external server; there is no local code-system browsing.

Open decisions: stack and location of the three planned surfaces; hosting of anything beyond the GitHub Pages docs site.

## Brand Commitments

- **Brand source of truth:** the tribehealth.ai marketing site, `../simple-ai-care/`. Its `DESIGN.md` ("Cited Letter") holds the Tribe Health identity: Ink Navy `#003b5c` over a cool desk ground and white sheets, Highlighter yellow reserved for evidence in focus, met/gap/void as the only other hues, Nexa for display and UI, Source Serif 4 for body text, square paper edges, hairline rules. Read it before any visual decision here; do not restate its tokens in this repo except in a surface's own `DESIGN.md`.
- Company name: Tribe Health (legal line "Tribe Health Solutions"). This product's name: Tribe Health FHIR Server.
- Logo: `../simple-ai-care/public/lovable-uploads/tribe-logo.png` and `6d05695b-7934-4d2b-a478-4b1bd8e833fb.png`. Nexa is self-hosted there (`public/fonts/nexa`); Tribe Health's Fontfabric license covers embedding it here (confirmed 2026-09-26), and the docs ship it from `website/src/fonts/nexa/`.
- The docs site (`website/`) carries the Tribe Health identity as of 2026-09-26 (see `website/DESIGN.md`); the WSO2 logo and orange are retired. Upstream WSO2 copyright notices, the Apache 2.0 license and fork attribution stay intact.
- "Kratos" is Ory Kratos, a third-party identity server. It is never a Tribe Health product name or brand; `KratosAIAssistant.png` is not a brand asset.
- ASO's own brand (Ember on slate/navy) belongs to that customer and is not Tribe Health's identity.
- The marketing site's surface decisions (light-only, letter composition, citation popovers) belong to that marketing site. Each surface here chooses its own mode and theme support; the docs site ships light and dark (dark is the "night desk").

## Evidence on Hand

Confirmed at company level (from `../simple-ai-care/PRODUCT.md`):
- Tribe Health is HIPAA compliant and signs BAAs.
- Advanced Spine & Orthopedics (ASO) is a live customer and may be named publicly (text only, no logo).

Specific to this server:
- Third-party performance benchmark naming the upstream server the fastest open-source FHIR server: https://healthsamurai.github.io/fhir-server-performance-benchmark/. It measures upstream WSO2, not Tribe Health's deployment; never present it as Tribe Health's result.
- HL7 FHIR 262 conformance report, rendered on the docs site (`website/src/components/Fhir262Report`).
- Architecture diagram: `docs/images/architecture.png`.

Absent, do not fabricate: SOC 2, HITRUST or ONC certification; quantified outcomes, testimonials, extra customer logos, pricing or uptime figures. Direct EHR integrations (Epic, Oracle Health, athenahealth) are onboarding targets, not live; X12 278 and Da Vinci PAS/CRD/DTR are not implemented. Label all of these as roadmap wherever they appear.

## Product Principles

1. **Trust over breadth.** Show an honest error or an empty state rather than a result that might be incomplete or wrong, mirroring fail-closed search.
2. **Minimum necessary by default.** Every surface shows the least patient data the job needs; PHI never appears where it is not required.
3. **One store, many audiences.** Engineers, integration teams, AI builders and clinical/billing staff read the same data at different depths; each surface speaks to its own audience without leaking another's complexity.
4. **Operational truth is visible.** Sync freshness, partner status, tenant and health state are first-class information, not buried diagnostics.

## Accessibility & Inclusion

Tribe Health's bar is WCAG 2.2 AA (the Workbench targets it and the marketing site meets it); every surface here uses the same bar. Clinical and billing staff are non-technical users, so surfaces they use need plain language and keyboard-accessible workflows.
