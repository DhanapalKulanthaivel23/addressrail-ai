import {describe,it,expect} from 'vitest';
import {executeDemo} from '../web/studio/shared/demo-engine.mjs';
import {generateFixture,applyEvidenceRepair} from '../web/studio/payment-intelligence/engine.mjs';
import type {DemoRequest} from '../web/studio/shared/contracts';
const run=(payload:Record<string,unknown>)=>executeDemo({contractVersion:1,synthetic:true,productId:'sct',scenarioId:'missing-town',syntheticEpoch:'2026-10-18T00:00:00.000Z',payload} satisfies DemoRequest);
describe('public execution contract',()=>{
 it('revalidates a manually approved evidence correction without model availability',()=>{
  const payload=generateFixture('sct','missing-town');
  const initial=run(payload),report=initial.report as any;
  expect(report.proposals).toHaveLength(1);
  const corrected=applyEvidenceRepair(payload,report.proposals[0]);
  const revalidated=run(corrected);
  expect((revalidated.report as any).proposals).toHaveLength(0);
  expect(revalidated.ai.status).toBe('DETERMINISTIC_FALLBACK');
  expect(payload.creditor.address.town).toBe('');
 });
 it('rejects changing a product while retaining another product payload',()=>{
  expect(()=>run(generateFixture('chaps','missing-town'))).toThrow(/mismatch/);
 });
});
