const DB='addressrail-synthetic-workbench-v1';
const STORE='session';
async function open():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>resolve(request.result);
 });
}
export async function sessionData(action:'read'|'save'|'clear',value?:unknown):Promise<unknown>{
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,action==='read'?'readonly':'readwrite');
  const store=tx.objectStore(STORE);
  const request=action==='read'?store.get('latest'):action==='save'?store.put(value,'latest'):store.delete('latest');
  let result:unknown;
  request.onsuccess=()=>{result=request.result};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 })}finally{db.close()}
}
