# Real Gemini evaluation evidence

The evaluation corpus is synthetic and authored. These results do not measure bank processing accuracy or certify payment rules.

| Run | Source commit | Grounded | Relevant citation | Status | No unsafe claim | Human review | Rule IDs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 39032297247 | b6a1a89 | 2/3 | 2/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| 39033237818 | c7eaf2b | 1/3 | 2/3 | 3/3 | 3/3 | 3/3 | 1/3 |

The first run was green because it recorded responses without enforcing metric thresholds. PR #4 fixed this: any rejected sample or failed metric returns exit status 1. The second run correctly failed; its artifact was uploaded despite the failed step and inspected directly.

## Failure analysis and correction

- EVAL-001 invented `SYNTHETIC-RULE-RJCT` despite an empty Go rule set.
- EVAL-003 invented `RULE-BOE-DELAY` despite an empty Go rule set. A retrieval source about standards timing is not a Go validation finding.
- EVAL-001's original generic rejection question expected the release-delay citation even though the higher-ranked base-schema and tracking references also addressed the generic question. The question now explicitly asks about deferred release timing and whether that determines the rejection cause. The expected citation and acceptance thresholds are unchanged. This changes the fixture; results across these corpus revisions are not directly comparable.

Generation now receives exact required rule IDs and an explicitly bounded response schema: empty rule arrays have `minItems=maxItems=0`, populated arrays enumerate only supplied IDs, status is fixed to the recorded status, evidence IDs enumerate supplied references, and citations enumerate retrieved sources. The independent validator still rejects invented IDs, changed status, wrong order, missing human review and unsafe claims even if a provider ignores its schema.

Reference: Google structured-output documentation. Generation constraints supplement independent checking and do not establish semantic correctness.

Live acceptance remains incomplete until the corrected code is exercised against the real provider and every metric passes. Secrets are read only inside GitHub Actions; no secret was downloaded or copied from chat.
