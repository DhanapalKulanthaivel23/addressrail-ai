package rails

import (
 "encoding/xml"
 "io"
 "regexp"
 "strings"
)

// XMLInspection is a bounded streaming check of *synthetic* message structure.
// It deliberately does not load external schema files, resolve entities or claim
// XSD/CBPR+/EPC/CHAPS conformance.
type XMLRequest struct {
 Synthetic bool `json:"synthetic"`
 Rail string `json:"rail"`
 Message string `json:"message"`
}
type XMLResult struct {
 Validator string `json:"validator"`
 WellFormed bool `json:"wellFormed"`
 ValidSubset bool `json:"validSubset"`
 MessageFamily string `json:"messageFamily,omitempty"`
 Namespace string `json:"namespace,omitempty"`
 Elements int `json:"elements"`
 Rules []Finding `json:"rules"`
 Synthetic bool `json:"synthetic"`
 SettlementAttested bool `json:"settlementAttested"`
 SafeToRetry bool `json:"safeToRetry"`
 Disclaimer string `json:"disclaimer"`
}
type xmlFrame struct {
 local string
 path string
 text strings.Builder
 sawAdrLine bool
}
var isoFamilyPattern=regexp.MustCompile(`^urn:iso:std:iso:20022:tech:xsd:((?:pacs\.(?:002|003|008|009)|pain\.(?:001|008)|camt\.053))\.001\.\d{2}$`)
var twoLetterCountry=regexp.MustCompile(`^[A-Z]{2}$`)
func InspectXML(request XMLRequest) XMLResult {
 result:=XMLResult{Validator:Version,Rules:[]Finding{},Synthetic:request.Synthetic,Disclaimer:Disclaimer}
 add:=func(id,path,desc string){result.Rules=append(result.Rules,Finding{id,path,"ERROR",desc})}
 if !request.Synthetic {add("XML-SYN","/synthetic","Only explicitly synthetic payment messages are accepted.");return result}
 if len(request.Message)==0||len(request.Message)>65536 {
  add("XML-SIZE","/message","Provide nonempty fictional XML up to 64 KiB.");return result
 }
 textUpper:=strings.ToUpper(request.Message)
 if !strings.Contains(textUpper,"SYNTHETIC")&&!strings.Contains(textUpper,"AR-DEMO")&&!strings.Contains(textUpper,"TEST-"){
  add("XML-PRIVACY","/message","A synthetic test-data marker is required. Do not submit real bank/customer messages.");return result
 }
 if strings.Contains(textUpper,"<!DOCTYPE")||strings.Contains(textUpper,"<!ENTITY"){
  add("XML-DTD","/message","DTD and ENTITY declarations are not accepted.");return result
 }
 decoder:=xml.NewDecoder(strings.NewReader(request.Message))
 decoder.Strict=true
 stack:=[]*xmlFrame{}
 namespace:=""
 family:=""
 seenHeader:=false
 seenAmount:=false
 seenRoot:=false
 for {
  token,err:=decoder.Token()
  if err==io.EOF {break}
  if err!=nil {add("XML-PARSE","/","Malformed XML or unsupported character encoding.");return result}
  switch item:=token.(type){
  case xml.Directive:
   add("XML-DIRECTIVE","/","XML directives are not accepted.");return result
  case xml.ProcInst:
   if strings.ToLower(item.Target)!="xml" {add("XML-PI","/","Unexpected XML processing instruction.");return result}
  case xml.StartElement:
   result.Elements++
   if result.Elements>5000 {add("XML-ELEMENTS","/","Too many elements for this educational inspection.");return result}
   if len(stack)>=48{add("XML-DEPTH","/","XML nesting exceeds safe limit.");return result}
   if len(stack)==0 {
    if seenRoot{add("XML-ROOT","/","Expected exactly one XML document root.");return result}
    seenRoot=true
    namespace=item.Name.Space
    if item.Name.Local!="Document"{add("XML-ROOT","/","Expected ISO 20022 Document root.");return result}
    matches:=isoFamilyPattern.FindStringSubmatch(namespace)
    if len(matches)==0{add("XML-NAMESPACE","/Document","Unexpected or unsupported ISO 20022 namespace.");return result}
    family=matches[1]
    result.Namespace=namespace
    result.MessageFamily=family
   }
   path:="/"+item.Name.Local
   if len(stack)>0 {
    parent:=stack[len(stack)-1]
    path=parent.path+"/"+item.Name.Local
    if parent.local=="PstlAdr"{
     if item.Name.Local=="AdrLine"{parent.sawAdrLine=true}
     if item.Name.Local=="Ctry"&&parent.sawAdrLine {
      add("XML-ADDR-ORDER",path,"Postal address Ctry must precede AdrLine in this example's ISO element order.")
     }
    }
   }
   if item.Name.Local=="GrpHdr"{seenHeader=true}
   if item.Name.Local=="IntrBkSttlmAmt"||item.Name.Local=="InstdAmt"{
    seenAmount=true
    if currency:=attr(item.Attr,"Ccy");currency!="" {
     if request.Rail=="CHAPS"&&currency!="GBP"{add("XML-RAIL-CCY",path,"CHAPS teaching amount should use GBP.")}
     if (request.Rail=="SCT"||request.Rail=="SCT_INST"||request.Rail=="SDD"||request.Rail=="T2")&&currency!="EUR"{
      add("XML-RAIL-CCY",path,"SEPA/T2 teaching amount should use EUR.")
     }
    }
   }
   stack=append(stack,&xmlFrame{local:item.Name.Local,path:path})
  case xml.CharData:
   if len(stack)>0 {
    top:=stack[len(stack)-1]
    if top.text.Len()<256 {fragment:=[]byte(item);if len(fragment)>256-top.text.Len(){fragment=fragment[:256-top.text.Len()]};top.text.Write(fragment)}
   }
  case xml.EndElement:
   if len(stack)==0{add("XML-PARSE","/","Unexpected closing element.");return result}
   top:=stack[len(stack)-1]
   content:=strings.TrimSpace(top.text.String())
   if top.local=="IBAN"&&!IBANValid(content){add("XML-IBAN",top.path,"IBAN failed educational length/mod-97 validation.")}
   if top.local=="BICFI"&& !BICValid(content){add("XML-BIC",top.path,"BIC failed basic 8/11-character format.")}
   if top.local=="Ctry"&&!twoLetterCountry.MatchString(content){add("XML-COUNTRY",top.path,"Expected two-letter uppercase country code.")}
   if top.local=="InstdAmt"||top.local=="IntrBkSttlmAmt"{
    if !amountValid(content){add("XML-AMOUNT",top.path,"Amount should be positive with up to two decimals.")}
   }
   stack=stack[:len(stack)-1]
  }
 }
 if !seenRoot{add("XML-ROOT","/","Missing XML Document root.");return result}
 if len(stack)!=0{add("XML-PARSE","/","Incomplete XML element stack.");return result}
 result.WellFormed=true
 if !seenHeader {add("XML-GRPHDR","/Document","Group header missing from this limited educational message check.")}
 if !seenAmount&&(family=="pacs.008"||family=="pacs.009"||family=="pacs.003"||family=="pain.001"||family=="pain.008"){
  add("XML-AMOUNT-MISSING","/Document","No expected payment amount found in this teaching message.")
 }
 // A parseable XML sketch is not a complete bank instruction or scheme-validated payload.
 result.ValidSubset=len(result.Rules)==0
 return result
}
func attr(attributes []xml.Attr,name string) string{
 for _,x:=range attributes{if x.Name.Local==name{return x.Value}}
 return ""
}
