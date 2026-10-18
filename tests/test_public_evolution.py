"""Verify public-only product history cannot be silently rewritten."""
import copy
import json
import unittest
from pathlib import Path
from scripts.check_public_evolution import ROOT,LEDGER,STATE,validate,assess
DATA=json.loads((ROOT/LEDGER).read_text())

class PublicEvolutionTests(unittest.TestCase):
    def test_public_safe_history_is_chronological(self):
        self.assertGreaterEqual(validate(DATA),5)
        self.assertEqual(DATA["events"][0]["date"],"2026-10-12")
        self.assertIn("internal rulepacks",DATA["notice"].lower())
    def test_ui_change_requires_new_event_and_updated_state(self):
        old=copy.deepcopy(DATA);old["events"]=old["events"][:-1]
        r=assess(old,DATA,["index.html",LEDGER,STATE])
        self.assertEqual(r["new_events"],1)
        for bad in (["index.html",LEDGER],["index.html",STATE]):
            with self.assertRaises(ValueError):assess(old,DATA,bad)
    def test_existing_backend_components_require_evolution_evidence(self):
        old=copy.deepcopy(DATA);old["events"]=old["events"][:-1]
        for source in ("saas/app.py", "network-simulator/network.py",
                       "cloudflare/payment-microservices/worker.mjs",
                       "rail-engine/cmd/raild/main.go", "payments-core/src/Payment.java",
                       "ai-agents/investigation/app.py", "deploy/run-rail-services.sh"):
            with self.subTest(source=source):
                with self.assertRaises(ValueError):assess(DATA,DATA,[source])
                self.assertEqual(assess(old,DATA,[source,LEDGER,STATE])["new_events"],1)

    def test_events_append_only_and_statuses_safe(self):
        old=copy.deepcopy(DATA)
        updated=copy.deepcopy(DATA)
        updated["events"][0]["description"]="A rewritten original event"
        with self.assertRaises(ValueError):assess(old,updated,[LEDGER,STATE,"src/app.js"])
        updated=copy.deepcopy(DATA)
        updated["events"][-1]["status"]="SWIFT_CERTIFIED"
        with self.assertRaises(ValueError):validate(updated)
if __name__=="__main__":
    unittest.main()
