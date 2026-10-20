import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRODUCTS} from '../web/studio/shared/product-registry.mjs';

test('Gemini public knowledge catalogue exactly covers workbench registry', () => {
  const data=JSON.parse(readFileSync(new URL('../backend/workbench_knowledge.json',import.meta.url),'utf8'));
  const rails=[...new Set(data.records.flatMap(record=>record.rails))];
  assert.equal(PRODUCTS.length,43);
  assert.deepEqual(rails.sort(),PRODUCTS.map(product=>product.id).sort());
  assert.equal(new Set(data.records.map(r=>r.id)).size,data.records.length);
  for(const record of data.records){
    assert.ok(record.rails.length>0);
    assert.ok(record.summary.length<=900);
    assert.ok(record.url.startsWith('https://'));
    assert.ok(!record.summary.includes('PRIVATE_MT_MX'));
  }
  const expanded=data.records.filter(r=>r.id.startsWith('WB-CONTEXT-'));
  assert.equal(expanded.length,38);
  assert.ok(expanded.every(r=>r.url.startsWith('https://github.com/DhanapalKulanthaivel23/addressrail-ai/')));
});
