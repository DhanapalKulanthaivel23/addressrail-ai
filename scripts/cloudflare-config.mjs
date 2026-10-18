import {readFileSync,writeFileSync} from 'node:fs';
const id=process.env.D1_DATABASE_ID;
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))throw Error('Valid D1_DATABASE_ID UUID required');
const path='cloudflare/payment-microservices/wrangler.gateway';
const source=readFileSync(path+'.toml','utf8');
writeFileSync(path+'.deploy.toml',source.replace(/^# (\[\[d1_databases\]\]|binding = "DB"|database_name = .*|database_id = .*)$/gm,'$1').replace('REPLACE_WITH_REAL_DATABASE_ID',id));
