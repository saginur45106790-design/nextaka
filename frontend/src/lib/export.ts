/** Export only authorized records already returned by the backend. */
export function sanitizedReport(value:unknown):unknown {
 if(Array.isArray(value))return value.map(sanitizedReport);
 if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/password|secret|tokenHash|csrfHash|ipHash/i.test(key)).map(([key,item])=>[key,sanitizedReport(item)]));
 return value;
}
export function downloadReport(section:string,records:unknown[]):void {
 const body=JSON.stringify({report:'NEXTAKA authorized current-page export',section,exportedAt:new Date().toISOString(),records:sanitizedReport(records)},null,2);
 const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=`nextaka-${section.replace(/[^a-z-]/g,'')}-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
