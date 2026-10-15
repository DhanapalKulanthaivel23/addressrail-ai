const $=id=>document.getElementById(id);
const element=(name,value)=>{const node=document.createElement(name);node.textContent=value;return node;};
$("run").addEventListener("click",async()=>{
 $("run").disabled=true;
 $("state").textContent="Running a synthetic case…";
 try {
  const response=await fetch("/api/v1/labs/sepa-instant/simulations",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({synthetic:true,rail:$("rail").value,scenario:$("scenario").value})
  });
  if(!response.ok) throw Error("Simulation unavailable (HTTP "+response.status+"). Start Quarkus in dev mode.");
  const receipt=await response.json();
  const [er,ir]=await Promise.all([fetch(receipt.eventsUrl),fetch(receipt.investigationUrl)]);
  if(!er.ok||!ir.ok)throw Error("Could not retrieve investigation evidence");
  const [events,investigation]=await Promise.all([er.json(),ir.json()]);
  $("title").textContent=receipt.paymentId+" / "+receipt.rail+" / "+receipt.status;
  $("events").replaceChildren();
  for(const event of events){
   const card=element("article","");card.className="event";
   card.append(element("b",event.type),element("p",event.description),element("small",event.evidenceRef));
   $("events").append(card);
  }
  $("detail").textContent=JSON.stringify(investigation,null,2);
  $("state").textContent="Teaching result: "+receipt.status+"; settlement: "+receipt.settlement+".";
 }catch(error){$("state").textContent=error.message;}
 finally{$("run").disabled=false;}
});