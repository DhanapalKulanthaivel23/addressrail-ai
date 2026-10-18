# Independent local parsing and loss-aware translation

The opt-in Python service extends the existing investigation API. It does not use Alliance Access, Alliance Gateway, a network translator or bank connections. All input must be explicitly synthetic and carry a `SYNTHETIC`, `TEST-` or `AR-DEMO` marker.

## Delivered scope

`POST /api/messages/v1/inspect` parses bounded `Document` XML in pain/pacs/camt namespaces into ordered, indexed field paths, values and attributes, with a source hash and a separate offline base-XSD verdict. Namespace recognition is not message conformance. Missing installed schemas return `SCHEMA_UNAVAILABLE`; unknown message types are not silently treated as supported translations.

`POST /api/messages/v1/translate` supports the **declared MT103 block-4 ↔ pacs.008.001.13/.14 field subset**. The last two pacs.008 base schemas were downloaded directly from the ISO catalogue/archive, preserved unmodified, checksum pinned, and used to validate synthetic generated candidates. This is independently implemented and not a Swift translation-rule implementation.

MT fields mapped: 20, 23B=CRED, 32A, 50K, 52A, 57A, 59, optional 70 and 71A. Amounts remain decimal text. Party address lines are preserved; country/town are never invented. Agent fields must be bare BICs. Party accounts, option-F addresses, extra MT fields, extra MX business fields, unsupported charges, overlength fields, mixed namespaces and batches are refused, with no translated output. Full FIN headers/trailers are unsupported.

MT-to-MX requires explicit enrichment for `message_id`, timezone-aware `creation_time`, `end_to_end_id`, full `settlement_date` and `settlement_method`. No timestamps, IDs, century or settlement method are invented. The full date must match the MT date within this synthetic profile's 2000–2099 range. Generated XML is a review candidate, with the exact schema verdict and an explicit `scheme_rules: NOT_ASSESSED`.

MX-to-MT lists every unsupported business path and refuses output. Supported MX header/end-to-end metadata cannot be represented by this narrow MT subset, so the default returns `LOSS_REQUIRES_ACKNOWLEDGEMENT` with exact affected fields. Only explicit `allow_metadata_loss: true` returns a `LOSSY_REVIEW_CANDIDATE`; the lost metadata is preserved in its sidecar report. It is never reported as lossless or network-ready.

## Security and configuration

Set `ADDRESSRAIL_ENABLE_TRANSLATION=true` and the existing `COPILOT_ENABLE_API=true`; configure `COPILOT_API_TOKEN` through the deployment secret manager. The existing gateway rejects missing tokens, tokens under its minimum length, browser-origin calls and untrusted forwarding. Bind only to loopback/private networking. This endpoint is not tenant-aware and must not be exposed as the customer SaaS API. Synthetic marker checking does not replace customer-data controls.

Set `ADDRESSRAIL_XSD_DIR` to the absolute path of `schemas/iso20022`. No runtime schema downloads, DTD/entity resolution or external imports are allowed. Responses use no-store caching. No payment is submitted or approved; settlement and safe-to-retry flags remain false.

## Not complete

- Full MT↔MX coverage, option/account mappings and all message variants.
- Last two base-schema versions for every applicable pain/pacs/camt message.
- Full permitted public-document-derived CBPR+ business rules and versioned provenance.
- Network BAH/FIN envelopes or Swift profile certification.
- Tenant Kafka integration and a hosted backend.

Public design references: ISO catalogue, Swift translation services. Public material is used for independent engineering; unavailable or restricted rules are not reverse-invented.
