import {createHash} from 'node:crypto';
const integer=(x,n)=>{if(!Number.isSafeInteger(x)||x<0||x>4294967295)throw Error(n+' must be a uint32 ledger');return x};
export function plan(input){
 if(input?.schemaVersion!==1||!['testnet','synthetic'].includes(input.network))throw Error('Unsupported schema/network');
 const current=integer(input.currentLedger,'currentLedger'),observed=integer(input.observedLedger,'observedLedger');if(observed>current)throw Error('Observation is from the future');
 const horizon=integer(input.horizonLedgers??1000,'horizonLedgers'),maxAge=integer(input.maxAgeLedgers??20,'maxAgeLedgers');
 if(!Array.isArray(input.entries)||input.entries.length<1||input.entries.length>100)throw Error('Expected 1–100 entries');
 const ids=new Set(),keys=new Set();
 for(const e of input.entries){if(!/^[a-z][a-z0-9-]{0,63}$/.test(e.id)||ids.has(e.id))throw Error('Invalid or duplicate entry ID');ids.add(e.id);if(typeof e.label!=='string'||!e.label.trim()||e.label.length>120)throw Error('Invalid label');if(!['code','instance','persistent','temporary'].includes(e.kind)||!['live','archived','missing'].includes(e.state))throw Error('Unknown entry type/state');if(!Array.isArray(e.dependsOn)||new Set(e.dependsOn).size!==e.dependsOn.length)throw Error('Invalid dependency list');if(e.keyXdr!==undefined){if(typeof e.keyXdr!=='string'||!e.keyXdr||e.keyXdr.length>4096||keys.has(e.keyXdr))throw Error('Invalid or duplicate ledger key');keys.add(e.keyXdr)}if(e.state==='live'){integer(e.liveUntilLedger,'liveUntilLedger');if(e.liveUntilLedger<observed)throw Error('Live entry expired before observation')}if(e.state==='archived'&&(e.kind==='temporary'||typeof e.evidenceRef!=='string'||!e.evidenceRef.trim()))throw Error('Archived state needs persistent storage and evidence reference');}
 const byId=new Map(input.entries.map(e=>[e.id,e])),visiting=new Set(),done=new Set(),ordered=[];
 function visit(e){if(visiting.has(e.id))throw Error('Dependency cycle');if(done.has(e.id))return;visiting.add(e.id);for(const d of e.dependsOn){if(!byId.has(d))throw Error('Unknown dependency '+d);visit(byId.get(d))}visiting.delete(e.id);done.add(e.id);ordered.push(e)}
 input.entries.forEach(visit);
 const stale=current-observed>maxAge, rows=[],status=new Map();
 for(const e of ordered){let action,reason,severity;
  if(stale){action='REFRESH';reason='Inventory exceeded its allowed ledger age';severity='blocked'}
  else if(e.state==='missing'){action='INVESTIGATE';reason=e.kind==='temporary'?'Missing temporary data cannot be restored; establish whether the application can recreate it':'A live-state lookup miss does not establish archival';severity='blocked'}
  else if(e.state==='archived'||e.liveUntilLedger<current){action=e.kind==='temporary'?'RECREATE':'SIMULATE_RESTORE';reason=e.kind==='temporary'?'Temporary data has expired and cannot be restored':'Simulate the intended invocation and inspect its restore list and fee before signing';severity=e.kind==='temporary'?'blocked':'attention'}
  else if(e.liveUntilLedger-current<horizon){action='EXTEND_TTL';reason='Live entry expires inside the selected ledger horizon; simulate an extension';severity='attention'}
  else{action='OBSERVE';reason='Observed lifetime covers the selected ledger horizon';severity='ready'}
  const blockedBy=e.dependsOn.filter(d=>status.get(d)?.severity==='blocked');if(blockedBy.length){reason+='; unresolved prerequisites: '+blockedBy.join(', ');severity='blocked'}
  const row={id:e.id,label:e.label,kind:e.kind,state:e.state,action,severity,reason,blockedBy,dependsOn:e.dependsOn,remainingLedgers:e.state==='live'?Math.max(0,e.liveUntilLedger-current):null,evidenceRef:e.evidenceRef??null};rows.push(row);status.set(e.id,row);
 }
 return {schemaVersion:1,network:input.network,currentLedger:current,observedLedger:observed,stale,inventoryHash:createHash('sha256').update(JSON.stringify(input)).digest('hex'),summary:{entries:rows.length,blocked:rows.filter(r=>r.severity==='blocked').length,attention:rows.filter(r=>r.severity==='attention').length,ready:rows.filter(r=>r.severity==='ready').length},steps:rows,notice:'Readiness assessment only. No keys held, no transactions built or submitted. Imported archival evidence is not independently authenticated.'};
}
export const demo={schemaVersion:1,network:'synthetic',currentLedger:10000,observedLedger:9996,horizonLedgers:1000,maxAgeLedgers:20,entries:[{id:'wasm',label:'Recovery record executable',kind:'code',state:'live',liveUntilLedger:20000,dependsOn:[]},{id:'instance',label:'Registry configuration',kind:'instance',state:'live',liveUntilLedger:10600,dependsOn:['wasm']},{id:'receipt',label:'Durable recovery record',kind:'persistent',state:'archived',evidenceRef:'synthetic:expired-persistent',dependsOn:['instance']},{id:'session',label:'Short-lived session hint',kind:'temporary',state:'missing',dependsOn:['instance']}]};
