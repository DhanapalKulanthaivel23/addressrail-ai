"""Reproducible synthetic evaluation. Default uses authored fixtures, not a live LLM.

Live mode is explicit, bounded, and uses a server environment key without logging it.
No real payment data or model narrative is written to the report.
"""
import argparse
import asyncio
import json
from pathlib import Path

from backend.workbench_ai import run_review

CASES = [
    {"rail": "cbpr", "codes": ["DEMO_UETR"], "source": "WB-CBPR"},
    {"rail": "sct", "codes": ["DEMO_ADDRESS_STRUCTURE"], "source": "WB-SCT"},
    {"rail": "sct-inst", "codes": ["DEMO_UNKNOWN_OUTCOME"], "source": "WB-INSTANT"},
    {"rail": "sdd-core", "codes": ["DEMO_MANDATE"], "source": "WB-SDD-CORE"},
    {"rail": "sdd-b2b", "codes": ["DEMO_MANDATE"], "source": "WB-SDD-B2B"},
]


def fixture(context):
    return {"mode": "gemini", "model": "AUTHORED_FIXTURE_NOT_A_PROVIDER", "review": {
        "summary": "The limited synthetic checks require manual evidence review.",
        "actions": ["Compare the finding definitions with the original synthetic evidence."],
        "cautions": ["This educational review does not establish scheme compliance or settlement."],
        "citation_ids": [context["retrieval"][0]["id"]] if context["retrieval"] else [],
        "finding_codes": context["evidence"]["finding_codes"],
        "human_review_required": True, "scope": "SYNTHETIC_EDUCATIONAL_ONLY"}}


async def evaluate(live=False, limit=5):
    async def authored(context):
        return fixture(context)
    if live:
        from backend.app import ask_workbench_gemini
        generate = ask_workbench_gemini
    else:
        generate = authored
    rows = []
    for case in CASES[:limit]:
        result = await run_review([{"rail": case["rail"], "stages": ["RECEIVED", "CHECKED"],
                                    "finding_codes": case["codes"]}], generate)
        retrieved = {s["id"] for s in result["retrieval"]}
        rows.append({"rail": case["rail"], "retrievalHitAt3": case["source"] in retrieved,
                     "outputAccepted": result["mode"] == "gemini",
                     "citationsAllowed": set(result["citationIds"]) <= retrieved,
                     "humanReviewRequired": result["humanReviewRequired"] is True,
                     "noCorrectionsApplied": result["correctionsApplied"] is False,
                     "fallbackReason": result["fallbackReason"], "durationMs": result["durationMs"]})
    metrics = {key: sum(row[key] for row in rows)/len(rows) for key in
               ("retrievalHitAt3", "outputAccepted", "citationsAllowed", "humanReviewRequired", "noCorrectionsApplied")}
    return {"mode": "live_provider" if live else "authored_contract_fixtures_not_live_ai",
            "semanticAccuracy": "not_measured", "bankAccuracyAndFairness": "not_measured",
            "metrics": metrics, "cases": rows, "passed": all(v == 1 for v in metrics.values())}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--confirm-live-provider-cost", action="store_true")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not 1 <= args.limit <= 5 or (args.live and not args.confirm_live_provider_cost):
        parser.error("Choose 1–5 cases; live mode requires explicit provider-cost confirmation.")
    result = asyncio.run(evaluate(args.live, args.limit))
    report = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(report + "\n")
    print(report)
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
