"""Quality failures must fail CI while preserving real-provider evidence."""
import asyncio
import json

import pytest

from investigation import eval_harness as harness
from investigation.copilot_llm import ModelAttempt


def record(accepted=True, **changes):
    evaluation = dict.fromkeys(harness.QUALITY_FIELDS, True)
    evaluation.update(changes)
    return {"accepted": accepted, "evaluation": evaluation}


def test_quality_gate_requires_acceptance_and_every_metric():
    assert harness.live_quality_passed([record(), record()])
    assert not harness.live_quality_passed([])
    assert not harness.live_quality_passed([record(accepted=False)])
    for field in harness.QUALITY_FIELDS:
        assert not harness.live_quality_passed([record(), record(**{field: False})])
    assert not harness.live_quality_passed([{"accepted": True, "evaluation": {}}])
    assert not harness.live_quality_passed([record(accepted="true")])


def test_rejected_real_response_is_retained_and_fails_quality(monkeypatch, tmp_path):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-not-a-real-key")
    async def rejected(*args):
        return ModelAttempt(None, False, "guardrail_rejected", "gemini", "test-model",
                            "a" * 64, "test-response-id", "{}", 10)
    monkeypatch.setattr(harness, "invoke_gemini", rejected)
    output = tmp_path / "rejected.jsonl"
    report = asyncio.run(harness.record_live(harness.evaluation_cases(), output, 1))
    assert report["quality_passed"] is False
    stored = json.loads(output.read_text())
    assert stored["accepted"] is False and stored["model_output"] == "{}"
    assert stored["provider_response_id"] == "test-response-id"


@pytest.mark.parametrize("quality_passed,exit_code", [(True, 0), (False, 1)])
def test_live_cli_exit_status(monkeypatch, tmp_path, quality_passed, exit_code):
    async def result(*args):
        return {"quality_passed": quality_passed, "recorded": 1}
    monkeypatch.setattr(harness, "record_live", result)
    monkeypatch.setattr("sys.argv", ["eval", "--live", "--confirm-live-provider-cost",
                                    "--limit", "1", "--output", str(tmp_path / "live.jsonl")])
    if exit_code:
        with pytest.raises(SystemExit) as error:
            harness.main()
        assert error.value.code == exit_code
    else:
        harness.main()
