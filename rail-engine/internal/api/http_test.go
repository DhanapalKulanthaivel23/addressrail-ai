package api

import (
 "bytes"
 "encoding/json"
 "net/http/httptest"
 "strings"
 "testing"
 "github.com/DhanapalKulanthaivel23/addressrail-ai/rail-engine/internal/rails"
)
func post(path string,input any) *httptest.ResponseRecorder {
 b,_:=json.Marshal(input)
 req:=httptest.NewRequest("POST",path,bytes.NewReader(b));req.Header.Set("Content-Type","application/json")
 rr:=httptest.NewRecorder();NewHandler().ServeHTTP(rr,req);return rr
}
func requestFixture() rails.ValidationRequest{
 return rails.ValidationRequest{Synthetic:true,Rail:"SCT",MessageType:"pacs.008",Currency:"EUR",Amount:"100.00",Reference:"AR-DEMO-01",DebtorIBAN:"DE89370400440532013000",CreditorIBAN:"FR1420041010050500013M02606"}
}
func TestHealth(t *testing.T){
 rr:=httptest.NewRecorder();NewHandler().ServeHTTP(rr,httptest.NewRequest("GET","/healthz",nil))
 if rr.Code!=200||!strings.Contains(rr.Body.String(),"synthetic-only"){t.Fatal(rr.Code,rr.Body.String())}
}
func TestValidationJSON(t *testing.T){
 rr:=post("/v1/validate",requestFixture())
 if rr.Code!=200{t.Fatal(rr.Code,rr.Body.String())}
 var result rails.ValidationResponse
 if err:=json.Unmarshal(rr.Body.Bytes(),&result);err!=nil||!result.ValidSubset||result.SettlementAttested||result.SafeToRetry{t.Fatalf("%+v %v",result,err)}
 if rr.Header().Get("Access-Control-Allow-Origin")!=""{t.Fatal("unexpected CORS")}
 req:=httptest.NewRequest("POST","/v1/validate",strings.NewReader(`{"synthetic":true,"secret":"token"}`))
 req.Header.Set("Content-Type","application/json")
 out:=httptest.NewRecorder();NewHandler().ServeHTTP(out,req)
 if out.Code!=400{t.Fatal("unknown input field accepted",out.Code)}
}
func TestBoundedAndMethod(t *testing.T){
 req:=httptest.NewRequest("POST","/v1/validate",strings.NewReader(strings.Repeat("X",70000)))
 req.Header.Set("Content-Type","application/json")
 rr:=httptest.NewRecorder();NewHandler().ServeHTTP(rr,req)
 if rr.Code!=413{t.Fatal("oversized body",rr.Code)}
 req=httptest.NewRequest("POST","/v1/validate",strings.NewReader("{}"))
 req.Header.Set("Content-Type","application/json");req.Header.Set("Origin","https://example.com")
 rr=httptest.NewRecorder();NewHandler().ServeHTTP(rr,req)
 if rr.Code!=403{t.Fatal("browser origin accepted",rr.Code)}
 req=httptest.NewRequest("GET","/v1/validate",nil)
 rr=httptest.NewRecorder();NewHandler().ServeHTTP(rr,req)
 if rr.Code!=405{t.Fatal("read method accepted",rr.Code)}
}
func TestBatchConcurrentOrdered(t *testing.T){
 r:=requestFixture()
 bad:=r;bad.Amount="-7"
 rr:=post("/v1/validate/batch",[]rails.ValidationRequest{r,bad,r})
 if rr.Code!=200{t.Fatal(rr.Code,rr.Body.String())}
 var result struct{Results []rails.ValidationResponse `json:"results"`}
 if err:=json.Unmarshal(rr.Body.Bytes(),&result);err!=nil{t.Fatal(err)}
 if len(result.Results)!=3||!result.Results[0].ValidSubset||result.Results[1].ValidSubset||!result.Results[2].ValidSubset{t.Fatal("batch order/validation",result)}
 tooMany:=make([]rails.ValidationRequest,101)
 rr=post("/v1/validate/batch",tooMany)
 if rr.Code!=422{t.Fatal("accepted >100",rr.Code)}
}
func TestReconcileContract(t *testing.T){
 req:=rails.ReconcileRequest{Synthetic:true,PaymentID:"PAY-10001",RecordedStatus:"UNKNOWN",Events:[]rails.EvidenceEvent{{PaymentID:"PAY-10001",OccurredAt:"2026-10-15T09:03:00Z",Type:"UNKNOWN",Source:"synthetic",EvidenceRef:"EDU-123"}}}
 rr:=post("/v1/reconcile",req)
 var got rails.ReconcileResponse
 if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
 if rr.Code!=200||got.Verdict!="REVIEW_REQUIRED"||got.SafeToRetry||got.SettlementAttested||len(got.Rules)==0{t.Fatal(rr.Code,got)}
}

func TestXMLInspectionHTTP(t *testing.T){
 sample:=`<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
 <FIToFICstmrCdtTrf><GrpHdr><MsgId>AR-DEMO-TEST</MsgId></GrpHdr>
 <CdtTrfTxInf><IntrBkSttlmAmt Ccy="EUR">1.00</IntrBkSttlmAmt>
 <Dbtr><Nm>SYNTHETIC BANK</Nm></Dbtr></CdtTrfTxInf></FIToFICstmrCdtTrf></Document>`
 rr:=post("/v1/xml/inspect",rails.XMLRequest{Synthetic:true,Rail:"SCT",Message:sample})
 if rr.Code!=200{t.Fatal(rr.Code,rr.Body.String())}
 var result rails.XMLResult
 if err:=json.Unmarshal(rr.Body.Bytes(),&result);err!=nil{t.Fatal(err)}
 if !result.ValidSubset||!result.WellFormed||result.SettlementAttested||result.SafeToRetry{
  t.Fatal(result)
 }
}
