"""Check offline-first AddressRail public pages do not link to unrelated sites."""
import re
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT=Path(__file__).resolve().parents[1]
class Anchors(HTMLParser):
    def __init__(self):
        super().__init__();self.externals=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()!="a":return
        href=dict(attrs).get("href","")
        if not href.startswith(("https://","http://")):return
        if re.match(r"^https://(?:dhanapalkulanthaivel23\.github\.io/addressrail-ai(?:/|$)|github\.com/DhanapalKulanthaivel23/addressrail-(?:ai|network-core)(?:/|$)|addressrail-[a-z-]+\.dhanapalkav\.workers\.dev(?:/|$))",href):return
        self.externals.append(href)

class OfflineBranding(unittest.TestCase):
    def test_project_owned_pages_have_no_offsite_source_anchors(self):
        bad={}
        for path in (ROOT/"web").rglob("*.html"):
            parser=Anchors();parser.feed(path.read_text(encoding="utf-8"))
            if parser.externals:bad[str(path.relative_to(ROOT))]=parser.externals
        for path in (ROOT/"payments-core"/"src"/"main"/"resources").rglob("*.html"):
            parser=Anchors();parser.feed(path.read_text(encoding="utf-8"))
            if parser.externals:bad[str(path.relative_to(ROOT))]=parser.externals
        self.assertFalse(bad,f"Non-owned outbound anchors remain: {bad}")

if __name__=="__main__":
    unittest.main()
