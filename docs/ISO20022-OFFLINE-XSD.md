# ISO 20022 offline base-schema validation

`ai-agents/investigation/schema_validation.py` supports a strict, bounded **offline XSD conformance check**, but the repository bundles **only the public ISO pacs.008.001.13 and .14 base XSDs** under `schemas/iso20022`, with original contents, provenance and checksum pins. It does not claim authority over ISO XSDs or Swift CBPR+ Usage Guidelines. The small XSD created within its unit test is synthetic and not an official ISO schema.

Provide your legally obtained ISO 20022 base XSD (for the precise message version deployed, e.g. `pacs.008.001.08`) through a private versioned directory. Add a local `manifest.json` such as:

```json
{"schemas":{"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08":{
  "file":"pacs.008.001.08.xsd",
  "sha256":"<64 hex chars from sha256sum>",
  "version":"operator-verified-pacs.008.001.08"
}}}
```

Set `ADDRESSRAIL_XSD_DIR` to this directory. No external entity or DTD processing, network schema downloads, traversal, symlink escape or unpinned schema modifications are permitted. The returned verdict is `BASE_XSD_VALID` or `BASE_XSD_INVALID`, including checksum and version. Absence yields **SCHEMA_UNAVAILABLE**, never an implied successful validation.

**Important**: ISO 20022 provides base schemas, while Swift **MyStandards** publishes network CBPR+ usage guidelines and testing. The rules are not equivalent. Current Swift usage material may require organisation account access and appropriate permission. Passing any base XSD check alone is **not Swift certification**, not a complete CBPR+ policy conformance result, and certainly not a settlement assertion. The current versioned-source RAG summaries are not sufficient replacement for official machine-testable guidelines.

Official sources: https://www.iso20022.org/iso-20022-message-definitions and https://www.swift.com/products/mystandards
