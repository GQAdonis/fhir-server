---
name: payer-documentation-rules
description: Determine what must be documented in the medical record to bill a procedure for a specific payer, and run prior-authorization and denial/appeal workflows with cited sources. Use for payer documentation requirements, medical-necessity criteria, prior auth (X12 278, FHIR Da Vinci PAS, CMS-0057-F), CPT/HCPCS/ICD-10 linkage, and CARC/RARC denial appeals.
license: Apache-2.0
---

# Payer documentation rules

Owner: `billing-prior-auth-specialist`, which writes to `docs/billing/`. Pair it with `healthcare-agents` (prior-auth appeal and denial-spike workflows) and, in Claude Code, the `healthcare@healthcare` plugin (`prior-auth`, `procedure-coding`, `icd10-cm`, CMS Coverage connector).

## Cite-sources rule (mandatory)

Payer rules change often and differ by plan, line of business and state, so **every requirement you state must cite a source**:
- Medicare: the governing **LCD/NCD** (ID and revision date) via the CMS Coverage database or connector, plus the related Billing and Coding Article.
- Medicare Advantage, Medicaid and commercial plans: the payer's medical or coverage policy URL, with its policy number and effective date.
- Coding: the CPT/HCPCS/ICD-10-CM code-set year; NCCI edits (quarter) for bundling and modifiers.

If no source is available, say "unverified — source needed" and do not present the rule as fact. Never rely on memorized payer rules.

## Documentation requirement workup

For a procedure, payer and plan, produce the following:
1. The codes (CPT/HCPCS plus modifiers) and the ICD-10-CM diagnoses that support medical necessity, with the coverage source.
2. The elements the record must contain: indications, prior conservative treatment and its duration, relevant results, the ordering provider, signatures and dates, each with a citation.
3. The mapping to FHIR resources in this server (e.g. `Condition`, `Procedure`, `ServiceRequest`, `Observation`, `DocumentReference`), so gaps can be queried.
4. The gaps and who must fix them (clinician, coder, front desk).

## Prior authorization

- Check whether PA is required (payer list, CRD/DTR where the payer supports Da Vinci IGs).
- Transport: X12 278 (the HIPAA standard) or FHIR Da Vinci PAS. CMS-0057-F has two separate compliance dates for impacted payers:
  - decision timeframes (72 h expedited, 7 calendar days standard) and specific denial reasons: from January 1, 2026;
  - the FHIR Prior Authorization API: from January 1, 2027.
  Confirm both on the CMS page, per the cite-sources rule.
- Track: request date, urgency, reference number, decision, expiry, and the units and dates authorized.

## Denials and appeals

1. Read the 835/EOB: group code (CO/PR/OA/PI), **CARC** and **RARC**. Classify as clinical (medical necessity), technical (missing PA, coding, eligibility) or timely filing.
2. For a technical denial, submit a corrected claim or reopening, not an appeal.
3. For a clinical denial, write an appeal letter that cites the payer's own policy criteria and points to the documentation meeting each criterion. Request peer-to-peer if available.
4. Track levels and deadlines:
   - **Original Medicare (Part A/B fee-for-service claims):** redetermination within 120 days, then reconsideration by a QIC (180 days), then ALJ.
   - **Medicare Advantage (Part C):** a separate, shorter process. The plan reconsideration must be requested within about 60–65 days of the denial notice. Cite the current CMS Part C appeals page and the plan's notice, and never apply the fee-for-service deadline to an MA denial.
   - **Medicaid managed care and commercial plans:** follow the plan's internal appeal process, then state fair hearing or external review under state or federal law.
5. Record denial patterns (counts per CARC/payer) in `docs/billing/`, without patient identifiers.

## Data rules

Drafting with real patient details is allowed only on a Tribe lane (`phi-lane-policy`). On the synthetic lane, use placeholders (`[PATIENT]`, `[DOS]`, `[MRN]`).

## References

- CMS Medicare Coverage Database: https://www.cms.gov/medicare-coverage-database/
- X12 CARC/RARC: https://x12.org/codes
- CMS-0057-F Interoperability and Prior Authorization Final Rule: https://www.cms.gov/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
- Da Vinci PAS IG: https://hl7.org/fhir/us/davinci-pas/
