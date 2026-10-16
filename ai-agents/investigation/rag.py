"""Version-pinned, curated sparse-vector retrieval of licensed-safe original summaries.

No network fetching, no automatic ingest of copyright-protected rulebooks, no
secret-bearing remote vector store. Retrieval returns *bounded evidence references*,
never a claim of official schema/business-rule conformance.
"""
from __future__ import annotations
from collections import Counter
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse
import json
import math
import re

CATALOGUE = Path(__file__).parent / "knowledge" / "catalogue.json"
TOKEN = re.compile(r"[a-z0-9]+(?:[.+-][a-z0-9]+)*", re.I)
ALLOWED_DOMAINS = {"www.swift.com", "www.iso20022.org",
                   "www.europeanpaymentscouncil.eu", "www.bankofengland.co.uk"}
INJECTION = re.compile(r"(?i)(ignore (?:previous|system|all) instructions|reveal (?:your )?prompt|"
                       r"bypass (?:human|system) review|send (?:an? )?api key|override (?:your )?rules)")
MAX_QUESTION = 360

def tokens(s: str) -> list[str]:
    if not isinstance(s, str):
        return []
    return TOKEN.findall(s.lower())[:300]

@dataclass(frozen=True)
class Citation:
    id: str
    rail: str
    topic: str
    version: str
    effective_date: str
    reviewed: str
    url: str
    excerpt: str
    score: float
    # External source summaries are untrusted retrieval data, never model instructions.

class KnowledgeStore:
    def __init__(self, catalogue: dict | None = None):
        doc = catalogue if catalogue is not None else json.loads(CATALOGUE.read_text(encoding="utf8"))
        entries = doc.get("records", [])
        if not isinstance(entries, list) or not entries or len(entries) > 500:
            raise ValueError("Bounded knowledge catalogue required")
        ids: set[str] = set()
        corpus = []
        for r in entries:
            if not isinstance(r, dict) or not {"id","rail","topic","version","effective_date","reviewed","url","facts"} <= r.keys():
                raise ValueError("Invalid knowledge record")
            if not re.fullmatch(r"[A-Z0-9-]{3,70}", r["id"]) or r["id"] in ids:
                raise ValueError("Duplicated/invalid source ID")
            ids.add(r["id"])
            parsed = urlparse(r["url"])
            if parsed.scheme != "https" or parsed.hostname not in ALLOWED_DOMAINS or parsed.username or parsed.password or parsed.fragment:
                raise ValueError("Only approved official HTTPS source URLs allowed")
            if any(not isinstance(r[k], str) or len(r[k]) > 1000 for k in r):
                raise ValueError("Oversized or invalid catalogue record")
            date.fromisoformat(r["effective_date"])
            date.fromisoformat(r["reviewed"])
            if INJECTION.search(r["facts"]):
                raise ValueError("Prompt injection text in curated evidence")
            corpus.append(r)
        self.records = tuple(corpus)
        # Local, deterministic sparse TF-IDF vectors. No embeddings or managed vector service.
        self.tf = [Counter(tokens(" ".join((r["topic"]+" ")*2 + (r["rail"]+" ")*2 + r["facts"]))) for r in corpus]
        df = Counter(token for doc_tokens in self.tf for token in doc_tokens)
        self.idf = {term:math.log(1+(len(corpus)+1)/(freq+1)) for term,freq in df.items()}
        self.vectors = [{k:(1+math.log(v))*self.idf[k] for k,v in counter.items()} for counter in self.tf]
        self.norms = [math.sqrt(sum(w*w for w in vec.values())) for vec in self.vectors]

    def search(self, question: str, rail: str | None = None,
               on_date: str | None = None, limit: int = 3) -> list[Citation]:
        if not isinstance(question, str) or not 3 <= len(question) <= MAX_QUESTION:
            raise ValueError("Question must be between 3 and 360 characters")
        if INJECTION.search(question):
            raise ValueError("Instruction-injection question refused")
        if rail is not None and (not re.fullmatch(r"[A-Z_]{2,12}", rail)):
            raise ValueError("Unrecognised rail filter")
        if not 1 <= limit <= 5:
            raise ValueError("Limit must be 1 to 5")
        when = date.fromisoformat(on_date) if on_date else date.today()
        query = Counter(tokens(question))
        qvector = {k:(1+math.log(n))*self.idf.get(k,0) for k,n in query.items()}
        qnorm = math.sqrt(sum(w*w for w in qvector.values()))
        if not qnorm:
            return []
        scored = []
        for i,record in enumerate(self.records):
            if date.fromisoformat(record["effective_date"]) > when:
                continue
            if rail and record["rail"] not in (rail, "ISO", "SEPA"):
                continue
            dot = sum(value*self.vectors[i].get(token,0) for token,value in qvector.items())
            value=dot/(qnorm*self.norms[i]) if self.norms[i] else 0
            if value < 0.055:
                continue
            # Explicit version is included in the citation, not inferred from AI.
            scored.append((value,record))
        scored.sort(key=lambda x:(-x[0],x[1]["id"]))
        return [Citation(id=r["id"],rail=r["rail"],topic=r["topic"],
                         version=r["version"],effective_date=r["effective_date"],
                         reviewed=r["reviewed"],url=r["url"],
                         excerpt=r["facts"][:620],score=round(score,4))
                for score,r in scored[:limit]]

@lru_cache(maxsize=1)
def standard_store() -> KnowledgeStore:
    return KnowledgeStore()
