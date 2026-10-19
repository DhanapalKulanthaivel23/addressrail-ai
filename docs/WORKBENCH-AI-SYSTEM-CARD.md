# Workbench AI system card

Version: 2026-10-19. Scope: public synthetic CBPR+, SCT, SCT Inst, SDD Core and SDD B2B educational review. This extends the existing Render service; the separate local investigation lab is not exposed publicly.

## Implemented concepts

| Concept | Implementation | Boundary |
| --- | --- | --- |
| RAG | Rail-filtered lexical TF-IDF search over versioned, curated original summaries; retrieved context supplied to Gemini; validated citation IDs linked to server-controlled source metadata | No embeddings, managed vector database, live web fetching or full rulebook ingest. Summaries are educational, not authoritative payment decisions. |
| Prompt engineering | Versioned instructions, separation of untrusted evidence, exact finding echoes, structured output schema and limited generation | Prompting alone does not guarantee correctness. |
| Agent framework | LangGraph validate → tools → generate → guard, with recursion bound and per-request state | A fixed review workflow, not an autonomous decision-making agent. No persistence/checkpointer. |
| Tool calling | LangChain typed tools `explain_findings` and `retrieve_sources`, called by the graph with validated arguments | Workflow-selected tools, not model-selected function calls. No payment writes, arbitrary URLs, shell access or private service calls. |
| Evaluation | Five-rail authored corpus, retrieval hit@3, output acceptance, citation allowlist, review/no-mutation checks, adversarial cases and browser regressions | Contract and retrieval metrics do not measure semantic truth, bank accuracy or demographic fairness. |
| Guardrails | Synthetic consent, reduced payload, existing Turnstile hostname/action verification and process quotas; input allowlist, structured output and independent citation/finding/safety checks; explicit fallback | Pattern checks cover selected unsafe claims, not every possible hallucination. Existing quotas are per-process best-effort demo controls, not durable distributed quotas. |
| Responsible AI | Data minimisation, source/version/provider transparency, no automatic actions, required human review, visible uncertainty and explicit fallback, local review acknowledgement, AI disable switch | Not an audited production governance or bank approval system. |

## Data and control flow

No Gemini request occurs until the user runs synthetic checks, consents, completes Turnstile and selects Ask Gemini. The browser sends only rail, two executed stages, bounded educational finding codes, consent and the verification token. No raw payment JSON, names, accounts, addresses or free-text question is sent by the workbench. This is a separate path from the unchanged legacy homepage address service.

The server validates evidence, verifies Turnstile, consumes existing quota, and invokes the graph. The two tools read local definitions and a small curated corpus. Source URLs are fixed metadata, not fetch targets. One Gemini call receives the reduced evidence, definitions, source summaries and JSON schema. There are no provider retries or model-selected tools. Returned findings must match the submitted order; citations must reference actually retrieved IDs. A source in the retrieval list is not necessarily cited by the model; the UI distinguishes those cases.

Each request returns a random trace ID, tool names/counts, prompt and knowledge versions, duration, and structural-check outcome. No prompt, generated narrative or payment data is persisted by this application. LangSmith tracing is explicitly disabled for this graph even if the environment enables it. The code does not configure provider retention; sending the reduced evidence to Gemini remains subject to the provider's applicable account terms.

On provider failure, incomplete generation or rejected output, the response uses deterministic fallback with `model: null`, no provider citation claims, and retained independently retrieved context. No result is labelled Gemini merely because configuration reports an enabled model. Editing/re-running the payment or withdrawing consent invalidates stale browser responses.

## Human oversight

Every result requires human review. A person can inspect original findings and linked sources and mark the explanation reviewed in the current view. This local acknowledgement resets with the payment/consent/result, is not persisted as an identity or audit approval, and never authorises a payment or applies a correction. Existing evidence-based correction approval and deterministic revalidation remain separate.

The original `ENABLE_AI` switch disables the protected service; checks work locally without it. Removing a corpus entry and publishing a new knowledge version is the correction path for unsuitable knowledge. Corpus changes require tests and the public change ledger. No official standards compliance, settled funds, verified beneficiary credit, sanctions clearance or safe retry can be awarded by this workflow.

## Evaluation and reproduction

Run `python -m pytest -q`, `python -m backend.evaluate_workbench`, the workbench build, and both workbench browser suites. CI uploads the authored-fixture metric report and fails if any metric misses its threshold. Adversarial tests cover unknown/invented citations, missing review, changed findings, unsupported URLs/accounts, selected unsafe payment claims, arbitrary tool arguments, failures and request isolation. Browser tests mock provider/Turnstile and cover all five rails, opt-in, link validation, fallback, provenance, stale responses and review acknowledgement.

The default evaluator explicitly reports `authored_contract_fixtures_not_live_ai`. It must never be used to claim genuine provider success. `semanticAccuracy` and `bankAccuracyAndFairness` are explicitly `not_measured`.

An optional manual `workbench-ai-live-eval.yml` workflow runs 1–3 synthetic provider calls only when the existing real-evaluation and free-tier-confirmation repository variables are both true. It uses the same allowlisted model as the existing investigation evaluation and the existing Actions secret; it does not fetch a secret to a developer machine or disable public Turnstile. Reports contain metrics/reason codes, not model narratives or secrets. No live run is claimed solely because this workflow exists. The CLI can also run with `--live --confirm-live-provider-cost --limit 3` when separately configured in an authorised server environment.

Before production, independent reviewers must evaluate factual claim support and citation relevance, changing standards, real authorisation, identity/tenant isolation, durable quotas, accessible review procedures, incident response, retention and meaningful operational/fairness risks. The synthetic corpus provides no evidence of performance on real bank transactions or protected groups.

## Technical references

Implementation follows the [LangGraph StateGraph API](https://docs.langchain.com/oss/python/langgraph/graph-api) and [Gemini structured output API](https://ai.google.dev/gemini-api/docs/structured-output). Knowledge records link official source landing pages and this repository's educational engine. They contain original summaries and no copied proprietary rulebook content or fixed current cutover claims.
