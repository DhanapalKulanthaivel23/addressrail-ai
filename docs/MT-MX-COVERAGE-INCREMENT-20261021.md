# Limited MT/MX browser coverage (2026-10-21)

New limited FIN free-format checks: MT199 and MT299, with synthetic positive and negative examples.

New exact-version ISO XML structure checks: pain.002.001.10, pacs.002.001.12 and camt.052.001.13. Representative synthetic structural witnesses and missing-field negatives are included in the accompanying regression test.

No new official XSDs, SWIFT FIN rulebooks, CBPR+ usage guidelines or production message processing are implemented here. Passing a structural check does not establish scheme conformance, successful settlement or authorisation to forward a message.

The private repository's existing 249-version pain/pacs/camt inventory is independent. This public increment neither changes private code nor publishes private assets.

Full SWIFT FIN type coverage, exact ISO schema validation, conditional rules, real-message fixtures and release-specific scheme profiles remain pending.
