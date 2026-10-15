const $=id=>document.getElementById(id);
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
$("run").addEventListener("click",async()=>{
 $("run").disabled=true;$("state").textContent="Creating local synthetic CHAPS case…";
 try{
  const response=await fetch("/api/v1/labs/chaps/simulations",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({synthetic:true,messageType:$("message-type").value,scenario:$("scenario").value})
  });
  if(!response.ok)throw Error("CHAPS teaching endpoint unavailable (HTTP "+response.status+"). Start Quarkus in dev mode.");
  const receipt=await response.json();
  const [eventsResponse,investigationResponse]=await Promise.all([
   fetch(receipt.eventsUrl),fetch(receipt.investigationUrl)
  ]);
  if(!eventsResponse.ok||!investigationResponse.ok)throw Error("Failed to retrieve recorded evidence.");
  const [events,investigation]=await Promise.all([eventsResponse.json(),investigationResponse.json()]);
  $("title").textContent=receipt.paymentId+" · "+receipt.status+" · "+receipt.settlement;
  $("events").replaceChildren();
  for(const e of events){
   const article=el("article","");article.className="event";
   article.append(el("b",e.type+" / "+e.source),el("p",e.description),el("small",e.evidenceRef));
   $("events").append(article);
  }
  $("details").textContent=JSON.stringify(investigation,null,2);
  $("state").textContent="Synthetic payment saved as "+receipt.paymentId+". No real settlement evidence.";
 }catch(error){$("state").textContent=error.message;}
 finally{$("run").disabled=false;}
});