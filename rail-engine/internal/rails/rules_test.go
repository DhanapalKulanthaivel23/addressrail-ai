package rails

import (
	"strings"
	"sync"
	"testing"
	"time"
)

func example() ValidationRequest {
	return ValidationRequest{Synthetic: true, Rail: "SCT", MessageType: "pacs.008", Currency: "EUR", Amount: "125.00", Reference: "AR-DEMO-SCT-001", DebtorIBAN: "DE89370400440532013000", CreditorIBAN: "FR1420041010050500013M02606", DebtorBIC: "DEUTDEFF", CreditorBIC: "BNPAFRPP"}
}
func contains(rules []Finding, id string) bool {
	for _, r := range rules {
		if r.ID == id {
			return true
		}
	}
	return false
}
func TestIBANAndBIC(t *testing.T) {
	for _, v := range []string{"GB82 WEST 1234 5698 7654 32", "DE89370400440532013000", "FR1420041010050500013M02606"} {
		if !IBANValid(v) {
			t.Fatalf("valid IBAN refused: %s", v)
		}
	}
	for _, v := range []string{"DE88370400440532013000", "DE8937040044053201300", "BR1800360305000010009795493C1", "", "DE89-3704"} {
		if IBANValid(v) {
			t.Fatalf("invalid/unsupported IBAN accepted: %s", v)
		}
	}
	for _, v := range []string{"DEUTDEFF", "DEUTDEFF500"} {
		if !BICValid(v) {
			t.Fatalf("valid bic %s", v)
		}
	}
	for _, v := range []string{"DEUTDEF", "DEUT12FF"} {
		if BICValid(v) {
			t.Fatalf("bad bic %s", v)
		}
	}
}
func TestSubsetAndSafety(t *testing.T) {
	v := Validate(example())
	if !v.ValidSubset || len(v.Rules) != 0 || v.SettlementAttested || v.SafeToRetry || v.Validator != Version {
		t.Fatalf("unexpected valid response: %+v", v)
	}
	cases := []struct {
		change func(*ValidationRequest)
		rule   string
	}{
		{func(r *ValidationRequest) { r.Synthetic = false }, "SYN-001"},
		{func(r *ValidationRequest) { r.Reference = "LIVE-ACCOUNT" }, "SYN-002"},
		{func(r *ValidationRequest) { r.CreditorIBAN = "DE88370400440532013000" }, "IBAN-001"},
		{func(r *ValidationRequest) { r.Rail = "SCT_INST"; r.Currency = "GBP" }, "RAIL-CCY"},
		{func(r *ValidationRequest) { r.Rail = "CHAPS"; r.MessageType = "pain.008" }, "RAIL-MSG"},
		{func(r *ValidationRequest) { r.Amount = "-5" }, "AMT-001"},
		{func(r *ValidationRequest) { r.Amount = "12.345" }, "AMT-001"},
		{func(r *ValidationRequest) { r.DebtorBIC = "DEUT12FF" }, "BIC-001"},
		{func(r *ValidationRequest) { r.Rail = "CBPR"; r.MessageType = "pacs.008" }, "UETR-REQUIRED"},
		{func(r *ValidationRequest) { r.UETR = "not-a-uuid" }, "UETR-001"},
		{func(r *ValidationRequest) { r.Rail = "TYPOS" }, "RAIL-001"},
	}
	for _, tc := range cases {
		r := example()
		tc.change(&r)
		got := Validate(r)
		if got.ValidSubset || !contains(got.Rules, tc.rule) || got.SafeToRetry || got.SettlementAttested {
			t.Fatalf("case %s: %+v", tc.rule, got)
		}
	}
}
func sampleEvent() EvidenceEvent {
	return EvidenceEvent{PaymentID: "PAY-10001", OccurredAt: "2026-10-13T09:03:00Z", Type: "RJCT", Source: "synthetic-feed", EvidenceRef: "DEMO-EVT-004"}
}
func TestReconciliation(t *testing.T) {
	request := ReconcileRequest{Synthetic: true, PaymentID: "PAY-10001", RecordedStatus: "RJCT", Events: []EvidenceEvent{sampleEvent()}}
	ok := Reconcile(request)
	if ok.Verdict != "CONSISTENT" || len(ok.Rules) != 0 || ok.SettlementAttested || ok.SafeToRetry {
		t.Fatalf("bad result: %+v", ok)
	}
	request.RecordedStatus = "UNKNOWN"
	bad := Reconcile(request)
	if bad.Verdict != "REVIEW_REQUIRED" || !contains(bad.Rules, "EVT-CONFLICT") {
		t.Fatal(bad)
	}
	request.RecordedStatus = "RJCT"
	request.Events[0].PaymentID = "OTHER"
	if !contains(Reconcile(request).Rules, "EVT-PAYMENT") {
		t.Fatal("wrong ID accepted")
	}
	request.Events[0] = sampleEvent()
	request.Events[0].Type = "UNKNOWN"
	request.RecordedStatus = "UNKNOWN"
	if !contains(Reconcile(request).Rules, "EVT-UNKNOWN") {
		t.Fatal("unknown outcome not flagged")
	}
	request.Events[0].Type = "PENDING"
	request.RecordedStatus = "PENDING"
	if !contains(Reconcile(request).Rules, "EVT-PENDING") {
		t.Fatal("pending outcome not flagged")
	}
	request.Events[0] = sampleEvent()
	request.Events = append(request.Events, request.Events[0])
	if !contains(Reconcile(request).Rules, "EVT-DUPLICATE") {
		t.Fatal("dup evidence allowed")
	}
	request.Events[1].EvidenceRef = "DIFFERENT"
	request.Events[1].OccurredAt = "2026-10-13T09:01:00Z"
	if !contains(Reconcile(request).Rules, "EVT-ORDER") {
		t.Fatal("unsorted evidence accepted")
	}
	request.Events = request.Events[:1]
	request.Events[0].OccurredAt = time.Now().Format(time.RFC3339)
	_ = Reconcile(request)
	request.Events[0].OccurredAt = "not-time"
	if !contains(Reconcile(request).Rules, "EVT-TIME") {
		t.Fatal("bad timestamp accepted")
	}
}
func TestConcurrentDeterminism(t *testing.T) {
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			out := Validate(example())
			if !out.ValidSubset {
				t.Error(out)
			}
		}()
	}
	wg.Wait()
}
func BenchmarkValidate(b *testing.B) {
	r := example()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		if !Validate(r).ValidSubset {
			b.Fatal("invalid")
		}
	}
}
func BenchmarkReconcile(b *testing.B) {
	v := ReconcileRequest{Synthetic: true, PaymentID: "PAY-10001", RecordedStatus: "UNKNOWN", Events: []EvidenceEvent{sampleEvent()}}
	v.Events[0].Type = "UNKNOWN"
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		if len(Reconcile(v).Rules) == 0 {
			b.Fatal("missing finding")
		}
	}
}
func TestNoLeak(t *testing.T) {
	if strings.Contains(Disclaimer, "production-ready") {
		t.Fatal("unsupported claim")
	}
}
