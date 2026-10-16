// Package rails owns fast deterministic, synthetic payment validation and
// evidence correlation. It is NOT an official ISO XSD, EPC, Swift or CHAPS checker.
package rails

import (
 "fmt"
 "math/big"
 "regexp"
 "strings"
 "time"
)

const Version = "addressrail-go-educational-v1"
const Disclaimer = "Synthetic rules subset only: no live payment, ISO XSD/scheme conformance, sanctions clearance, retry authorisation or settlement attestation."

type Finding struct {
 ID string `json:"id"`
 Path string `json:"path"`
 Severity string `json:"severity"`
 Message string `json:"message"`
}
type ValidationRequest struct {
 Synthetic bool `json:"synthetic"`
 Rail string `json:"rail"`
 MessageType string `json:"messageType"`
 Currency string `json:"currency"`
 Amount string `json:"amount"`
 Reference string `json:"reference"`
 DebtorIBAN string `json:"debtorIban,omitempty"`
 CreditorIBAN string `json:"creditorIban,omitempty"`
 DebtorBIC string `json:"debtorBic,omitempty"`
 CreditorBIC string `json:"creditorBic,omitempty"`
 UETR string `json:"uetr,omitempty"`
}
type ValidationResponse struct {
 Validator string `json:"validator"`
 Rail string `json:"rail"`
 ValidSubset bool `json:"validSubset"`
 Rules []Finding `json:"rules"`
 Synthetic bool `json:"synthetic"`
 SettlementAttested bool `json:"settlementAttested"`
 SafeToRetry bool `json:"safeToRetry"`
 Disclaimer string `json:"disclaimer"`
}
type EvidenceEvent struct {
 PaymentID string `json:"paymentId"`
 OccurredAt string `json:"occurredAt"`
 Type string `json:"type"`
 Source string `json:"source"`
 EvidenceRef string `json:"evidenceRef"`
}
type ReconcileRequest struct {
 Synthetic bool `json:"synthetic"`
 PaymentID string `json:"paymentId"`
 RecordedStatus string `json:"recordedStatus"`
 Events []EvidenceEvent `json:"events"`
}
type ReconcileResponse struct {
 Validator string `json:"validator"`
 Verdict string `json:"verdict"`
 RecordedStatus string `json:"recordedStatus"`
 LatestEventType string `json:"latestEventType,omitempty"`
 Rules []Finding `json:"rules"`
 EvidenceRefs []string `json:"evidenceRefs"`
 Synthetic bool `json:"synthetic"`
 SettlementAttested bool `json:"settlementAttested"`
 SafeToRetry bool `json:"safeToRetry"`
 Disclaimer string `json:"disclaimer"`
}
type railProfile struct {
 currency string // empty means no single mandated currency in these teaching checks
 messages map[string]bool
 requireIBAN bool
 requireUETR bool
}
func allowed(messages ...string) map[string]bool {
 m:=make(map[string]bool,len(messages))
 for _,x:=range messages{m[x]=true}
 return m
}
var profiles = map[string]railProfile{
 "SCT": {"EUR",allowed("pain.001","pacs.008","pacs.002","pacs.004"),true,false},
 "SCT_INST": {"EUR",allowed("pacs.008","pacs.002"),true,false},
 "SDD": {"EUR",allowed("pain.008","pacs.003","pacs.002","pacs.004"),true,false},
 "CHAPS": {"GBP",allowed("pacs.008","pacs.009","pacs.002"),false,false},
 "FPS": {"GBP",allowed("FPS_MESSAGE"),false,false},
 "BACS": {"GBP",allowed("BACS_FILE"),false,false},
 "T2": {"EUR",allowed("pacs.008","pacs.009","camt.053"),false,false},
 "CBPR": {"",allowed("pacs.008","pacs.009","pacs.002","pacs.004"),false,true},
 "CLS": {"",allowed("CLS_INSTRUCTION"),false,false},
}
var (
 referencePattern=regexp.MustCompile(`^(AR-DEMO-|SYNTHETIC-|TEST-)[A-Za-z0-9_-]{1,60}$`)
 bicPattern=regexp.MustCompile(`^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$`)
 amountPattern=regexp.MustCompile(`^[0-9]{1,12}(\.[0-9]{1,2})?$`)
 currencyPattern=regexp.MustCompile(`^[A-Z]{3}$`)
 idPattern=regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)
 uetrPattern=regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)
)
var ibanLengths=map[string]int{"GB":22,"DE":22,"FR":27,"ES":24,"IT":27,"NL":18,"BE":16,"PL":28,"SE":24,"DK":18,"NO":15,"FI":18,"IE":22,"PT":25,"LU":20,"AT":20,"CH":21,"LT":20,"LV":21,"EE":20,"GR":27,"CY":28,"MT":31}
func IBANValid(raw string) bool {
 iban:=strings.ToUpper(strings.ReplaceAll(raw," ",""))
 if len(iban)<15||len(iban)>34{return false}
 expected,known:=ibanLengths[iban[:2]]
 if !known||len(iban)!=expected{return false} // Only recognised countries in this educational subset.
 for i,c:=range iban {
  if i<2 && (c<'A'||c>'Z') {return false}
  if i>=2&&i<4&&(c<'0'||c>'9'){return false}
  if c<'0'||c>'9'{if c<'A'||c>'Z'{return false}}
 }
 rearranged:=iban[4:]+iban[:4]
 remainder:=0
 for _,ch:=range rearranged {
  var digits string
  if ch>='A'&&ch<='Z'{digits=fmt.Sprintf("%d",int(ch-'A')+10)}else{digits=string(ch)}
  for _,digit:=range digits{remainder=(remainder*10+int(digit-'0'))%97}
 }
 return remainder==1
}
func BICValid(raw string) bool {return bicPattern.MatchString(strings.ToUpper(raw))}
func UETRValid(raw string) bool {return uetrPattern.MatchString(raw)}
func amountValid(raw string) bool {
 if !amountPattern.MatchString(raw){return false}
 n,ok:=new(big.Rat).SetString(raw)
 return ok&&n.Sign()>0
}
func Validate(req ValidationRequest) ValidationResponse {
 response:=ValidationResponse{Validator:Version,Rail:req.Rail,Rules:[]Finding{},Synthetic:req.Synthetic,Disclaimer:Disclaimer}
 add:=func(id,path,message string){response.Rules=append(response.Rules,Finding{id,path,"ERROR",message})}
 if !req.Synthetic {add("SYN-001","/synthetic","Explicit synthetic:true required.");response.ValidSubset=false;return response}
 if !referencePattern.MatchString(req.Reference){add("SYN-002","/reference","Use an AR-DEMO-, SYNTHETIC- or TEST- fictional reference, never a real account/customer identifier.")}
 profile,ok:=profiles[req.Rail]
 if !ok{add("RAIL-001","/rail","Unsupported educational rail.");response.ValidSubset=false;return response}
 if !currencyPattern.MatchString(req.Currency){add("CCY-001","/currency","Expected uppercase three-letter currency code.")}
 if profile.currency!=""&&req.Currency!=profile.currency{add("RAIL-CCY","/currency","This educational rail example expects "+profile.currency+".")}
 if !profile.messages[req.MessageType]{add("RAIL-MSG","/messageType","Message family is not in the supported synthetic subset for this rail.")}
 if !amountValid(req.Amount){add("AMT-001","/amount","Positive decimal amount with no more than two fractional digits is required.")}
 if profile.requireIBAN{
  if req.DebtorIBAN==""{add("IBAN-REQUIRED","/debtorIban","An IBAN is required for this educational rail example.")}
  if req.CreditorIBAN==""{add("IBAN-REQUIRED","/creditorIban","An IBAN is required for this educational rail example.")}
 }
 for _,v:=range []struct{key,value string}{{"debtorIban",req.DebtorIBAN},{"creditorIban",req.CreditorIBAN}}{
  if v.value!=""&&!IBANValid(v.value){add("IBAN-001","/"+v.key,"Basic IBAN length/format/mod-97 check failed (not ownership).")}
 }
 for _,v:=range []struct{key,value string}{{"debtorBic",req.DebtorBIC},{"creditorBic",req.CreditorBIC}}{
  if v.value!=""&&!BICValid(v.value){add("BIC-001","/"+v.key,"Basic 8/11-character BIC format failed.")}
 }
 if req.UETR!=""&&!UETRValid(req.UETR){add("UETR-001","/uetr","RFC 4122-style version 4 UETR format is invalid.")}
 if profile.requireUETR&&req.UETR==""{add("UETR-REQUIRED","/uetr","CBPR+ teaching profile needs a fictional UETR.")}
 response.ValidSubset=len(response.Rules)==0
 return response
}
func Reconcile(req ReconcileRequest) ReconcileResponse {
 result:=ReconcileResponse{Validator:Version,Verdict:"REVIEW_REQUIRED",RecordedStatus:req.RecordedStatus,Rules:[]Finding{},EvidenceRefs:[]string{},Synthetic:req.Synthetic,Disclaimer:Disclaimer}
 add:=func(id,path,message string){result.Rules=append(result.Rules,Finding{id,path,"REVIEW",message})}
 if !req.Synthetic {add("EVT-SYN","/synthetic","Only fictional payment evidence is supported.");return result}
 if !idPattern.MatchString(req.PaymentID){add("EVT-ID","/paymentId","Invalid fictional payment identifier.");return result}
 if len(req.Events)==0||len(req.Events)>256{add("EVT-COUNT","/events","1 to 256 ordered synthetic events required.");return result}
 var previous time.Time
 seen:=make(map[string]bool,len(req.Events))
 for i,event:=range req.Events {
  path:=fmt.Sprintf("/events/%d",i)
  if event.PaymentID!=req.PaymentID{add("EVT-PAYMENT",path+"/paymentId","Event belongs to a different payment.")}
  instant,err:=time.Parse(time.RFC3339Nano,event.OccurredAt)
  if err!=nil{add("EVT-TIME",path+"/occurredAt","Invalid RFC3339 event time.")}
  if err==nil&&!previous.IsZero()&&instant.Before(previous){add("EVT-ORDER",path+"/occurredAt","Events are out of chronological order.")}
  if err==nil{previous=instant}
  if event.Source==""||len(event.Source)>80{add("EVT-SOURCE",path+"/source","Event source is missing/oversized.")}
  if event.EvidenceRef==""||len(event.EvidenceRef)>120{add("EVT-REF",path+"/evidenceRef","Missing/oversized evidence reference.")}
  if event.EvidenceRef!=""&&seen[event.EvidenceRef]{add("EVT-DUPLICATE",path+"/evidenceRef","Duplicate evidence reference; review correlation.")}
  seen[event.EvidenceRef]=true
  if event.Type==""||len(event.Type)>50{add("EVT-TYPE",path+"/type","Missing/oversized event type.")}
  result.EvidenceRefs=append(result.EvidenceRefs,event.EvidenceRef)
 }
 result.LatestEventType=req.Events[len(req.Events)-1].Type
 if result.LatestEventType!=req.RecordedStatus{
  add("EVT-CONFLICT","/recordedStatus","Stored payment status conflicts with last event; do not infer an outcome.")
 }
 if len(result.Rules)>0{return result}
 switch req.RecordedStatus {
 case "UNKNOWN":
  add("EVT-UNKNOWN","/recordedStatus","Timeout or missing confirmation: reconcile with authorised source before retry.")
 case "PENDING":
  add("EVT-PENDING","/recordedStatus","Processing or liquidity hold: do not assert settlement.")
 case "RJCT","ACTC","ACSP","ACSC","SIMULATED":
  // Agreement between synthetic last status and stored status, not settlement proof.
  result.Verdict="CONSISTENT"
 default:
  add("EVT-UNSUPPORTED","/recordedStatus","Unrecognised status in the educational subset.")
 }
 return result
}
