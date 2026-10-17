import {test} from "node:test";
import assert from "node:assert/strict";
import {swiftFlow,sepaFlow,rtgsFlow} from "../cloudflare/payment-microservices/rail-flows.mjs";
const base={synthetic:true,senderBic:"BANKDEFF",receiverBic:"BANKFRPP"};
test("SWIFT multi-hop event trail keeps transport ACK distinct from bank status",()=>{
 const r=swiftFlow({...base,intermediaries:["BANKGB2L"]});
 assert.deepEqual(r.events.map(x=>x.type),["SUBMITTED","NETWORK_ACK","DELIVERED","DELIVERED","BANK_STATUS"]);
 assert.equal(r.state,"ACSP");assert.equal(r.settlementAttested,false);
});
test("network NACK and uncertain intermediary delivery cannot invent bank acceptance",()=>{
 assert.equal(swiftFlow({...base,simulateNetworkNack:true}).state,"REJECTED");
 const r=swiftFlow({...base,intermediaries:["BANKGB2L"],simulateTimeoutAt:1});
 assert.equal(r.state,"UNKNOWN");assert.ok(!r.events.some(e=>e.type==="BANK_STATUS"));
});
test("SEPA SCT Inst unknown outcomes and SDD mandatory mandates",()=>{
 assert.equal(sepaFlow({synthetic:true,scheme:"SCT_INST",currency:"EUR",simulateTimeout:true}).state,"UNKNOWN");
 assert.throws(()=>sepaFlow({synthetic:true,scheme:"SDD_CORE",currency:"EUR"}),/missing_mandate/);
 assert.equal(sepaFlow({synthetic:true,scheme:"SDD_CORE",currency:"EUR",mandateId:"SYN-MANDATE"}).state,"CLEARING_ACCEPTED");
});
test("SEPA Core refund and B2B refund restrictions are distinguished",()=>{
 assert.equal(sepaFlow({synthetic:true,scheme:"SDD_CORE",currency:"EUR",action:"REFUND"}).state,"REFUND_SIMULATED");
 assert.throws(()=>sepaFlow({synthetic:true,scheme:"SDD_B2B",currency:"EUR",action:"REFUND",refundReason:"NO_QUESTIONS_ASKED"}),/no_unconditional_refund/);
});
test("CHAPS and T2 demonstrate currency and liquidity queues",()=>{
 assert.equal(rtgsFlow({synthetic:true,rail:"CHAPS",currency:"GBP",availableMinor:"100",amountMinor:"200"}).state,"QUEUED_LIQUIDITY");
 const r=rtgsFlow({synthetic:true,rail:"T2",currency:"EUR",availableMinor:"500",amountMinor:"200"});
 assert.equal(r.balanceMinor,"300");assert.equal(r.state,"SIMULATED_SETTLED");assert.equal(r.settlementAttested,false);
 assert.throws(()=>rtgsFlow({synthetic:true,rail:"CHAPS",currency:"EUR",availableMinor:"100",amountMinor:"50"}),/currency_mismatch/);
});
