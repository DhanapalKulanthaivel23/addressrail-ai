"""Regression tests for explicit schema-version registration."""
import json
from pathlib import Path
import tempfile
import unittest

from schemas.iso20022.versioned_catalogue import register_from_manifest, resolve


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "schemas" / "iso20022" / "manifest.json"


class CatalogueTests(unittest.TestCase):
    def test_installed_versions_are_exact(self):
        entries = register_from_manifest(MANIFEST)
        self.assertEqual(set(entries), {"pacs.008.001.13", "pacs.008.001.14"})
        self.assertTrue(all(e.base_xsd_available for e in entries.values()))
        self.assertTrue(all(e.scheme_validation == "NOT_ASSESSED" for e in entries.values()))

    def test_missing_families_and_versions_fail_closed(self):
        for identifier in ("pain.001.001.09", "camt.053.001.14", "pacs.008.001.08",
                           "MT103", "pacs.008.001.15", "../pacs.008.001.14"):
            self.assertIsNone(resolve(identifier, MANIFEST))

    def test_unpinned_version_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "pain.001.001.09.xsd").write_text("x", encoding="utf-8")
            (directory / "manifest.json").write_text(json.dumps({"schemas": {
                "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09": {
                    "file": "pain.001.001.09.xsd", "sha256": "oops", "version": "sample"
                }
            }}), encoding="utf-8")
            with self.assertRaises(ValueError):
                register_from_manifest(directory / "manifest.json")


if __name__ == "__main__":
    unittest.main()
