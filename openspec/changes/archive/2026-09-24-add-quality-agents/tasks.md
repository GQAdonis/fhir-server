## 1. Agents

Skill placement (per the phase rule adopted in add-architecture-agents review: frontmatter `skills:` preloads only repo-resident skills; machine-local skills listed below are named under 'Invoke when needed' in the prompt).

- [x] 1.1 Write `.claude/agents/fhir-code-reviewer.md` (sonnet; `tools: Read, Grep, Glob, Bash`; `disallowedTools: Edit, Write`; CLAUDE.md conventions + constraints.md checklist; severity output contract; code-review-and-quality, adversarial-review, karpathy-guidelines); verify frontmatter parses, Edit/Write are excluded, preloaded skills are repo-resident, and prompt-named skills resolve or are documented prerequisites
- [x] 1.2 Write `.claude/agents/fhir-security-compliance-reviewer.md` (opus; read-only; PHI/HIPAA, RLS/tenant, SQL injection in search.go, `.prometheus/` content review; security-review, hipaa-compliance, healthcare-phi-compliance, security-and-hardening); verify frontmatter parses, Edit/Write are excluded, preloaded skills are repo-resident, and prompt-named skills resolve or are documented prerequisites
- [x] 1.3 Write `.claude/agents/fhir-conformance-validator.md` (sonnet; read-only; opsx:verify, kbd-goal-check, verification-before-completion, verification-loop; exact command list incl. race-integration when store/handler touched); verify frontmatter parses, Edit/Write are excluded, preloaded skills are repo-resident, and prompt-named skills resolve or are documented prerequisites

## 2. Smoke

- [x] 2.1 Give `fhir-code-reviewer` a seeded diff that silently drops an unsupported search parameter; verify it returns a CRITICAL finding and verdict BLOCK
- [x] 2.2 Ask `fhir-conformance-validator` for its verification command list for a change touching `internal/store`; verify it includes the race-integration command
