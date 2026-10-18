"""Strict, OFFLINE ISO 20022 XSD validation using operator-provisioned schemas.

No schemas or Swift usage guidelines are bundled. The operator must source and
license the specific base XSD, pin its SHA-256 and date/version in the manifest.
A conforming ISO base XSD NEVER establishes Swift CBPR+ usage conformance.
"""
from __future__ import annotations
from dataclasses import asdict,dataclass
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import re
from lxml import etree

NS_VERSION=re.compile(r"^urn:iso:std:iso:20022:tech:xsd:(pacs|pain|camt)\.\d{3}\.\d{3}\.\d{2}$")
FILE_NAME=re.compile(r"^[a-z0-9_.-]{8,96}\.xsd$")
MAX_XML=48000
MAX_XSD=5*1024*1024

@dataclass(frozen=True)
class SchemaVerdict:
    status:str
    message_namespace:str|None
    schema_sha256:str|None
    schema_version:str|None
    provenance:str
    errors:list[str]
    certified_cbpr:bool=False
    official_schema_asserted:bool=False

    def asdict(self):
        return asdict(self)

class RejectResource(etree.Resolver):
    def resolve(self,url,pubid,context):
        raise ValueError("External DTD/XSD imports are not permitted")

def offline_parser():
    parser=etree.XMLParser(resolve_entities=False,no_network=True,
       load_dtd=False,huge_tree=False,remove_comments=False,
       recover=False)
    parser.resolvers.add(RejectResource())
    return parser

def inspect(xml:str, schema_dir:str|None=None) -> SchemaVerdict:
    if not isinstance(xml,str) or not 1<=len(xml.encode("utf-8"))<=MAX_XML:
        raise ValueError("Unbounded or absent XML")
    if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():
        raise ValueError("DTD/entity declaration refused")
    try:
        doc=etree.fromstring(xml.encode("utf-8"),parser=offline_parser())
    except (etree.XMLSyntaxError,ValueError) as exc:
        return SchemaVerdict("INVALID_XML",None,None,None,
             "untrusted-xml",["XML_PARSE_ERROR"])
    if etree.QName(doc).localname != "Document":
        return SchemaVerdict("UNSUPPORTED_ROOT",None,None,None,
             "untrusted-xml",["ROOT_NOT_DOCUMENT"])
    namespace=etree.QName(doc).namespace
    if not isinstance(namespace,str) or not NS_VERSION.fullmatch(namespace):
        return SchemaVerdict("UNSUPPORTED_NAMESPACE",namespace,None,None,
                             "untrusted-xml",["UNKNOWN_OR_NON_PAYMENT_NAMESPACE"])
    if schema_dir is None:
        schema_dir=os.getenv("ADDRESSRAIL_XSD_DIR")
    if not schema_dir:
        return SchemaVerdict("SCHEMA_UNAVAILABLE",namespace,None,None,
                            "no-schema-provisioned",["BASE_XSD_NOT_INSTALLED"])
    source=Path(schema_dir).resolve(strict=True)
    if not source.is_dir():
        raise ValueError("A locked local XSD directory is required")
    manifest_path=source / "manifest.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf8"))
    entries=manifest.get("schemas",{})
    meta=entries.get(namespace)
    if not isinstance(meta,dict):
        return SchemaVerdict("SCHEMA_UNAVAILABLE",namespace,None,None,
                            "not-in-version-pinned-manifest",["BASE_XSD_NOT_INSTALLED"])
    filename=meta.get("file")
    digest=meta.get("sha256")
    version=meta.get("version")
    if not isinstance(filename,str) or not FILE_NAME.fullmatch(filename):
        raise ValueError("Unsafe XSD manifest filename")
    if not isinstance(digest,str) or not re.fullmatch(r"[0-9a-f]{64}",digest):
        raise ValueError("Expected pinned XSD SHA-256")
    if not isinstance(version,str) or len(version)>80 or not version:
        raise ValueError("Missing XSD version provenance")
    target=(source / filename).resolve(strict=True)
    if target.parent != source:
        raise ValueError("XSD symlinks and paths leaving directory are forbidden")
    data=target.read_bytes()
    if not 10<len(data)<=MAX_XSD or sha256(data).hexdigest()!=digest:
        raise ValueError("Pinned XSD checksum mismatch")
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("XSD DTD/entity declaration refused")
    try:
        schema_doc=etree.parse(BytesIO(data),parser=offline_parser())
        xsd=etree.XMLSchema(schema_doc)
        valid=xsd.validate(doc)
    except (etree.XMLSchemaError,etree.XMLSyntaxError,ValueError):
        return SchemaVerdict("SCHEMA_LOAD_ERROR",namespace,digest,version,
                            "operator-supplied-offline-XSD",["INVALID_OR_IMPORT_DEPENDENT_XSD"])
    # Only issue codes; never expose full source content/PII in reports/logs.
    return SchemaVerdict("BASE_XSD_VALID" if valid else "BASE_XSD_INVALID",
        namespace,digest,version,"operator-supplied-offline-XSD",
        [] if valid else ["OFFLINE_XSD_VALIDATION_FAILED"])
