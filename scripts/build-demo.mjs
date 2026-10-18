import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync} from 'node:fs';
mkdirSync('.demo-build',{recursive:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.demo.json'],{stdio:'inherit'});
for(const file of ['product-registry.mjs','demo-engine.mjs'])copyFileSync('.demo-build/shared/'+file,'web/studio/shared/'+file);
