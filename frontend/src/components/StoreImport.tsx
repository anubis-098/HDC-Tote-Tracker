import { useState } from "react";
import { Upload } from "lucide-react";
import { api, message } from "../lib/api";
import { useLanguage } from "../lib/i18n";
export function StoreImport({onImported}: {onImported: () => Promise<void>}) {
  const language = useLanguage();
  const en = language === "en";
  const [file,setFile] = useState<File|null>(null);
  const [sheet,setSheet] = useState("");
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState("");
  return <section className="panel"><h2><Upload size={18}/> {en ? "Upload Store Excel" : "\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32 Store Excel"}</h2>
    <p>{en ? "XLSX: ST. No / ST. Name or Store No. / Store Name. Adds new codes and updates names. Other Stores and their active status are preserved." : "\u0e40\u0e1e\u0e34\u0e48\u0e21 Store \u0e43\u0e2b\u0e21\u0e48\u0e41\u0e25\u0e30\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e0a\u0e37\u0e48\u0e2d\u0e23\u0e2b\u0e31\u0e2a\u0e40\u0e14\u0e34\u0e21 (ST. No / ST. Name \u0e2b\u0e23\u0e37\u0e2d Store No. / Store Name)"}</p>
    <div className="table-tools"><input aria-label="Excel file" type="file" accept=".xlsx" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setStatus("");}}/>
    <label>Sheet <input placeholder={en ? "Blank = first sheet" : "Master HLE"} value={sheet} disabled={busy} onChange={e=>setSheet(e.target.value)}/></label>
    <button type="button" disabled={!file || busy} onClick={async()=>{if(!file)return;setBusy(true);setStatus("");try { const body=new FormData();body.append("file",file);body.append("sheet",sheet);const result=await api<{imported:number}>("/admin/stores/import",{method:"POST",body});setStatus(`${result.imported} Stores imported`);await onImported();}catch(e){setStatus(message(e));}finally{setBusy(false);}}}>{busy ? "?" : en ? "Upload Excel" : "\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14 Excel"}</button></div>
    {status && <p role="status">{status}</p>}
  </section>;
}
