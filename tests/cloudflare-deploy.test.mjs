import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,rmSync} from 'node:fs';
test('generated gateway config preserves relative entry point and binds only validated D1 UUID',()=>{
 const file='cloudflare/payment-microservices/wrangler.gateway.deploy.toml';
 try{
 const run=id=>spawnSync(process.execPath,['scripts/cloudflare-config.mjs'],{env:{...process.env,D1_DATABASE_ID:id},encoding:'utf8'});
 assert.notEqual(run('bad\n[[services]]').status,0);
 assert.equal(run('00000000-0000-0000-0000-000000000001').status,0);
 const config=readFileSync(file,'utf8');assert.match(config,/main = "\.\/worker.mjs"/);assert.match(config,/\n\[\[d1_databases\]\]\nbinding = "DB"/);assert.ok(!config.includes('REPLACE_WITH_REAL_DATABASE_ID'));
 }finally{rmSync(file,{force:true})}
});
test('deployment fails before remote operations with absent credentials',()=>{
 const result=spawnSync('bash',['scripts/cloudflare-deploy.sh'],{env:{PATH:process.env.PATH},encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stdout,/Missing CLOUDFLARE_API_TOKEN/);
 execFileSync('bash',['-n','scripts/cloudflare-deploy.sh']);
});
