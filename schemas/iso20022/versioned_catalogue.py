"""Fail-closed, versioned inventory of installed ISO 20022 base XSDs.

This catalogue never treats recognition of a message identifier as proof of
XSD validation or payment-scheme conformance.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re

MESSAGE_ID = re.compile(r"^(pain|pacs|camt)\.[0-9]{3}\.[0-9]{3}\.[0-9]{2,3}$")
NAMESPACE_PREFIX = "urn:iso:std:iso:20022:tech:xsd:"


@dataclass(frozen=True)
class Registration:
    message_id: str
    namespace: str
    schema_file: str
    schema_sha256: str
    provenance: str
    base_xsd_available: bool
    scheme_validation: str = "NOT_ASSESSED"


def register_from_manifest(manifest_path: str | Path) -> dict[str, Registration]:
    """Read version pins without ever asserting a missing schema is available."""
    path = Path(manifest_path).resolve(strict=True)
    raw = json.loads(path.read_text(encoding="utf-8"))
    entries = raw.get("schemas")
    if not isinstance(entries, dict):
        raise ValueError("Expected schema manifest mapping")
    registrations: dict[str, Registration] = {}
    for namespace, metadata in entries.items():
        if not isinstance(namespace, str) or not namespace.startswith(NAMESPACE_PREFIX):
            raise ValueError("Unsupported schema namespace")
        identifier = namespace[len(NAMESPACE_PREFIX):]
        if not MESSAGE_ID.fullmatch(identifier) or not isinstance(metadata, dict):
            raise ValueError("Unsupported ISO message registration")
        filename, digest, provenance = (metadata.get("file"), metadata.get("sha256"), metadata.get("version"))
        if filename != identifier + ".xsd":
            raise ValueError("Schema filename must match exact registered version")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError("Schema pin missing or invalid")
        if not isinstance(provenance, str) or not provenance.strip():
            raise ValueError("Schema provenance missing")
        xsd_path = (path.parent / filename).resolve(strict=True)
        if xsd_path.parent != path.parent:
            raise ValueError("Schema path must stay within manifest directory")
        # The offline validator, not this inventory, checks content SHA and XSD semantics.
        registrations[identifier] = Registration(
            identifier, namespace, filename, digest, provenance,
            base_xsd_available=xsd_path.is_file(),
        )
    return registrations


def resolve(identifier: str, manifest_path: str | Path) -> Registration | None:
    """Unregistered versions are unsupported; never guess a neighboring version."""
    if not isinstance(identifier, str) or not MESSAGE_ID.fullmatch(identifier):
        return None
    return register_from_manifest(manifest_path).get(identifier)
