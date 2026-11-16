import { useState } from "react";
import { Upload, Check, LoaderCircle, Trash2 } from "lucide-react";
import { api, message } from "../lib/api";
import { useLanguage } from "../lib/i18n";
export function StoreImport({onImported}: {onImported: () => Promise<void>}) {
  const language = useLanguage();
  const en = language === "en";
  const [file,setFile] = useState<File|null>(null);
  const [sheets,setSheets] = useState<string[]>([]);
  const [sheet,setSheet] = useState("");
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState("");
  return <section className="panel"><h2><Upload size={18}/> {en ? "Upload Store Excel" : "\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32 Store Excel"}</h2>
    <p>{en ? "XLSX: ST / Store Name, ST. No / ST. Name or Store No. / Store Name. Adds new codes and updates names. Other Stores and their active status are preserved." : "\u0e40\u0e1e\u0e34\u0e48\u0e21 Store \u0e43\u0e2b\u0e21\u0e48\u0e41\u0e25\u0e30\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e0a\u0e37\u0e48\u0e2d\u0e23\u0e2b\u0e31\u0e2a\u0e40\u0e14\u0e34\u0e21 (ST. No / ST. Name \u0e2b\u0e23\u0e37\u0e2d Store No. / Store Name)"}</p>
    <div className="table-tools"><input aria-label="Excel file" type="file" accept=".xlsx" disabled={busy} onChange={async e=>{const next=e.target.files?.[0]??null;setFile(null);setSheets([]);setSheet("");setStatus("");if(!next)return;setBusy(true);try{const body=new FormData();body.append("file",next);const result=await api<{sheets:string[]}>("/admin/stores/excel-sheets",{method:"POST",body});setSheets(result.sheets);setSheet(result.sheets[0]??"");setFile(next);}catch(error){setStatus(message(error));}finally{setBusy(false);}}}/>
    <label>Sheet <select value={sheet} disabled={busy || !sheets.length} onChange={e=>setSheet(e.target.value)}><option value="">{en ? "Select a sheet" : "\u0e40\u0e25\u0e37\u0e2d\u0e01 Sheet"}</option>{sheets.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    <button type="button" style={{background:busy || !file ? "#64748b" : "#15803d",color:"#fff",border:"none",borderRadius:8,padding:"12px 20px",fontWeight:700,display:"inline-flex",alignItems:"center",gap:8,minHeight:44}} disabled={!file || !sheet || busy} onClick={async()=>{if(!file)return;setBusy(true);setStatus("");try { const body=new FormData();body.append("file",file);body.append("sheet",sheet);const result=await api<{imported:number}>("/admin/stores/import",{method:"POST",body});setStatus(`${result.imported} Stores imported`);await onImported();}catch(e){setStatus(message(e));}finally{setBusy(false);}}}>{busy ? <LoaderCircle size={20}/> : <Check size={20}/>} {busy ? "?" : en ? "Confirm import" : "\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14 Excel"}</button></div>
    <button type="button" disabled={busy} style={{background:"#b91c1c",color:"white",border:0,borderRadius:8,padding:"10px 16px",display:"inline-flex",gap:8,alignItems:"center",marginTop:12}} onClick={async()=>{
      const confirmation=window.prompt(en ? "Remove all Stores from the list. Existing Trip/Tote history is preserved. Type DELETE ALL STORES to confirm." : "\u0e25\u0e1a Store \u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u0e42\u0e14\u0e22\u0e40\u0e01\u0e47\u0e1a\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e07\u0e32\u0e19\u0e40\u0e14\u0e34\u0e21 \u0e1e\u0e34\u0e21\u0e1e\u0e4c DELETE ALL STORES \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19");
      if(confirmation!=="DELETE ALL STORES")return;setBusy(true);setStatus("");try{const result=await api<{deleted:number}>("/admin/stores/delete-all",{method:"POST",body:JSON.stringify({confirmation})});setStatus(`${result.deleted} Stores removed`);await onImported();}catch(error){setStatus(message(error));}finally{setBusy(false);}
    }}><Trash2 size={18}/>{en ? "Delete all Stores" : "\u0e25\u0e1a\u0e23\u0e32\u0e22\u0e0a\u0e37\u0e48\u0e2d Store \u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14"}</button>
    {status && <p role="status">{status}</p>}
  </section>;
}
