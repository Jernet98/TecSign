const pending=new Map();
export function loadScript(path) {
  const url=new URL(path,document.baseURI).href;
  if(!pending.has(url)) pending.set(url,new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=url;
    script.onload=()=>resolve();script.onerror=()=>{pending.delete(url);reject(Error(`No se pudo cargar ${path}`));};
    document.head.append(script);
  }));
  return pending.get(url);
}
export async function fetchJSON(url) {
  const res=await fetch(url,{cache:'no-cache'});if(!res.ok) throw Error(`${url}: HTTP ${res.status}`);return res.json();
}
