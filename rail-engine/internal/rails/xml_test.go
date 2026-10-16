package rails

import (
	"strings"
	"testing"
)

const validXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
 <FIToFICstmrCdtTrf><GrpHdr><MsgId>AR-DEMO-101</MsgId></GrpHdr>
 <CdtTrfTxInf><PmtId><EndToEndId>AR-DEMO-101</EndToEndId></PmtId>
 <IntrBkSttlmAmt Ccy="EUR">25.00</IntrBkSttlmAmt>
 <Dbtr><Nm>SYNTHETIC SENDER</Nm><PstlAdr><TwnNm>London</TwnNm><Ctry>GB</Ctry><AdrLine>10 Test Road</AdrLine></PstlAdr></Dbtr>
 <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
 </CdtTrfTxInf></FIToFICstmrCdtTrf>
</Document>`

func TestStreamingXMLSubset(t *testing.T) {
	ok := InspectXML(XMLRequest{Synthetic: true, Rail: "SCT", Message: validXML})
	if !ok.WellFormed || !ok.ValidSubset || ok.SettlementAttested || ok.SafeToRetry || ok.MessageFamily != "pacs.008" || ok.Elements < 5 {
		t.Fatalf("valid fictional sketch: %+v", ok)
	}
	badOrder := strings.Replace(validXML, "<TwnNm>London</TwnNm><Ctry>GB</Ctry><AdrLine>10 Test Road</AdrLine>", "<AdrLine>10 Test Road</AdrLine><TwnNm>London</TwnNm><Ctry>GB</Ctry>", 1)
	if !contains(InspectXML(XMLRequest{Synthetic: true, Rail: "SCT", Message: badOrder}).Rules, "XML-ADDR-ORDER") {
		t.Fatal("bad address sequence not flagged")
	}
	badIBAN := strings.Replace(validXML, "DE89370400440532013000", "DE88370400440532013000", 1)
	if !contains(InspectXML(XMLRequest{Synthetic: true, Rail: "SCT", Message: badIBAN}).Rules, "XML-IBAN") {
		t.Fatal("bad iban not flagged")
	}
	wrongCCY := strings.Replace(validXML, `Ccy="EUR"`, `Ccy="GBP"`, 1)
	if !contains(InspectXML(XMLRequest{Synthetic: true, Rail: "SCT", Message: wrongCCY}).Rules, "XML-RAIL-CCY") {
		t.Fatal("wrong SEPA currency not flagged")
	}
	malformed := strings.Replace(validXML, "</Document>", "</Missing>", 1)
	if !contains(InspectXML(XMLRequest{Synthetic: true, Rail: "SCT", Message: malformed}).Rules, "XML-PARSE") {
		t.Fatal("malformed document was accepted")
	}
	for _, test := range []struct {
		input XMLRequest
		code  string
	}{
		{XMLRequest{Synthetic: false, Rail: "SCT", Message: validXML}, "XML-SYN"},
		{XMLRequest{Synthetic: true, Rail: "SCT", Message: "<Document>JOHN DOE</Document>"}, "XML-PRIVACY"},
		{XMLRequest{Synthetic: true, Rail: "SCT", Message: "<!DOCTYPE r><Document>SYNTHETIC</Document>"}, "XML-DTD"},
		{XMLRequest{Synthetic: true, Rail: "SCT", Message: strings.Repeat("SYNTHETIC", 10000)}, "XML-SIZE"},
		{XMLRequest{Synthetic: true, Rail: "SCT", Message: "<Document>SYNTHETIC</Document>"}, "XML-NAMESPACE"},
	} {
		if !contains(InspectXML(test.input).Rules, test.code) {
			t.Fatalf("no %s for %#v", test.code, test.input.Rail)
		}
	}
}
func BenchmarkXMLInspect(b *testing.B) {
	r := XMLRequest{Synthetic: true, Rail: "SCT", Message: validXML}
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		if !InspectXML(r).ValidSubset {
			b.Fatal("inspection changed")
		}
	}
}
