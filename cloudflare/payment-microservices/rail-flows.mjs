// Synthetic payment rail state engines. Not an implementation of proprietary SWIFT,
// EPC CSM, CHAPS or Eurosystem protocols. No money is moved.
export function swiftFlow(p){
 if(!p.synthetic)throw Error("synthetic_only");
 const hops=[p.senderBic||"BANKADEF",...(p.intermediaries||[]),p.receiverBic];
 if(hops.length>6)throw Error("too_many_hops");
 if(hops.some(x=>!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(x)))throw Error("invalid_bic");
 const events=[{type:"SUBMITTED",by:hops[0]},{type:"NETWORK_ACK",by:"SIMULATED_SWIFT"}];
 if(p.simulateNetworkNack)return {state:"REJECTED",events:[events[0],{type:"NETWORK_NACK",reason:"SYNTHETIC_NETWORK_REJECTION"}],hops,settlementAttested:false};
 for(let i=1;i<hops.length;i++){
   events.push({type:"DELIVERED",from:hops[i-1],to:hops[i]});
   if(p.simulateTimeoutAt===i)return {state:"UNKNOWN",events:[...events,{type:"DELIVERY_OUTCOME_UNKNOWN",at:hops[i]}],hops,settlementAttested:false};
 }
 const state=p.simulateReject?"RJCT":"ACSP";
 events.push({type:"BANK_STATUS",by:hops.at(-1),status:state});
 return {state,events,hops,settlementAttested:false};
}
export function sepaFlow(p){
 if(!p.synthetic)throw Error("synthetic_only");
 const schemes=["SCT","SCT_INST","SDD_CORE","SDD_B2B"];
 if(!schemes.includes(p.scheme))throw Error("unknown_sepa_scheme");
 if(p.currency!=="EUR")throw Error("sepa_requires_eur");
 const action=p.action||"PAYMENT";
 if(!["PAYMENT","RECALL","RETURN","REFUND"].includes(action))throw Error("unsupported_action");
 if(p.scheme==="SDD_B2B"&&action==="REFUND"&&p.refundReason==="NO_QUESTIONS_ASKED")throw Error("sdd_b2b_no_unconditional_refund");
 if(p.scheme.startsWith("SDD")&&action==="PAYMENT"&&!p.mandateId)throw Error("missing_mandate");
 if(p.scheme==="SCT_INST"&&p.simulateTimeout)return {state:"UNKNOWN",events:[{type:"INSTANT_TIMEOUT",reason:"OUTCOME_UNKNOWN"}],settlementAttested:false};
 const event=action==="PAYMENT"?"CSM_ACCEPTED":action+"_REQUESTED";
 const state=p.simulateReject?"REJECTED":action==="PAYMENT"?"CLEARING_ACCEPTED":action+"_SIMULATED";
 return {state,events:[{type:"SUBMITTED",scheme:p.scheme},{type:event},{type:state}],settlementAttested:false};
}
export function rtgsFlow(p){
 if(!p.synthetic)throw Error("synthetic_only");
 const ccy=p.rail==="CHAPS"?"GBP":p.rail==="T2"?"EUR":p.currency;
 if(p.currency!==ccy)throw Error("currency_mismatch");
 const available=BigInt(p.availableMinor??0),amount=BigInt(p.amountMinor??0);
 if(amount<=0n||available<0n)throw Error("invalid_amount");
 const events=[{type:"SETTLEMENT_SUBMITTED",rail:p.rail}];
 if(available<amount)return {state:"QUEUED_LIQUIDITY",events:[...events,{type:"LIQUIDITY_INSUFFICIENT"}],balanceMinor:available.toString(),settlementAttested:false};
 return {state:"SIMULATED_SETTLED",events:[...events,{type:"LIQUIDITY_RESERVED",amountMinor:amount.toString()},{type:"SIMULATED_SETTLED"}],balanceMinor:(available-amount).toString(),settlementAttested:false};
}
