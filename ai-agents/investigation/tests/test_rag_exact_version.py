"""Exact metadata-version RAG retrieval regression tests."""
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from investigation.rag import KnowledgeStore

def record(ident, version, effective):
    return dict(id=ident, rail="CBPR", topic="message standards",
                version=version, effective_date=effective, reviewed="2026-10-20",
                url="https://www.swift.com/standards/standards-releases",
                facts="CBPR payment address business message standards review")

class ExactVersionRetrievalTests(unittest.TestCase):
    def setUp(self):
        self.store=KnowledgeStore({"records":[record("EXAMPLE-2025","SR2025","2025-01-01"),
                                              record("EXAMPLE-2026","SR2026","2026-01-01")]})

    def test_exact_versions_never_mix(self):
        for version,expected in (("SR2025","EXAMPLE-2025"),("SR2026","EXAMPLE-2026")):
            with self.subTest(version=version):
                found=self.store.search("CBPR payment address standards",version=version)
                self.assertEqual([item.id for item in found],[expected])
        self.assertEqual(self.store.search("CBPR payment address standards",version="SR2027"),[])

    def test_effective_date_still_applies(self):
        self.assertEqual(self.store.search("CBPR payment address standards",
                                            version="SR2026",on_date="2025-10-01"),[])

    def test_invalid_version_filters_rejected(self):
        for version in ("", "SR2026|SR2025", "../", "X"*101, 123):
            with self.subTest(version=version),self.assertRaises(ValueError):
                self.store.search("CBPR payment address standards",version=version)

if __name__=="__main__":
    unittest.main()
