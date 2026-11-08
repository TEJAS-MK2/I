import {useEffect,useRef,useState} from "react";
import {Mic,MicOff,ShieldCheck,Sparkles} from "lucide-react";
import {parseKhataUtterance} from "./proposal";
import {validateKhataProposal} from "./transactionValidation";
import {createBrowserSpeechProvider} from "./speech";
import {useBusiness} from "../business/BusinessContext";
import {supabase} from "../lib/supabase";
import {rupeesToPaise} from "../domain/transaction";

const languages=[["Hinglish / Hindi","hi-IN"],["Bengali","bn-IN"],["English (India)","en-IN"],["Tamil","ta-IN"],["Telugu","te-IN"],["Marathi","mr-IN"],["Gujarati","gu-IN"],["Kannada","kn-IN"],["Malayalam","ml-IN"],["Punjabi","pa-IN"]];
export default function VoiceWorkspace({onContinue}:{onContinue?:()=>void}){
 const {business,configured}=useBusiness();
 const [language,setLanguage]=useState("hi-IN"),[transcript,setTranscript]=useState(""),[listening,setListening]=useState(false),[notice,setNotice]=useState("Choose a language and speak, or type a note below.");
 const [inputMode,setInputMode]=useState<"speech"|"text">("text"),[reviewed,setReviewed]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[saveError,setSaveError]=useState(""),[idempotencyKey,setIdempotencyKey]=useState(()=>crypto.randomUUID());
 const controller=useRef<{stop:()=>void}|null>(null),proposal=parseKhataUtterance(transcript),validation=proposal?validateKhataProposal(proposal):null;
 useEffect(()=>()=>controller.current?.stop(),[]);
 async function saveProposal(){
  if(!supabase||!business||!proposal||!validation?.valid||!reviewed)return;
  const amountPaise=rupeesToPaise(proposal.amount);
  if(amountPaise===null){setSaveError("The amount could not be converted to exact paise.");return;}
  setSaving(true);setSaveError("");setSaved(false);
  const {error}=await supabase.functions.invoke("voice-proposals",{body:{
   business_id:business.id,language_tag:language,input_mode:inputMode,transcript_text:transcript.trim(),
   intent:proposal.kind,proposal:{customer_name:proposal.customerName,amount_paise:amountPaise,currency:proposal.currency,
    items:proposal.items.map(item=>({name:item.name,quantity:item.quantity,unit:item.unit}))},
   confidence:null,ambiguity_flags:[],idempotency_key:idempotencyKey,confirmed:true,
  }});
  if(error)setSaveError("The proposal could not be saved. Review the details and retry.");
  else{setSaved(true);setNotice("Reviewed proposal saved. No sale, ledger or stock record has been created.");}
  setSaving(false);
 }
 function updateTranscript(value:string){setTranscript(value);setInputMode("text");setReviewed(false);setSaved(false);setSaveError("");setIdempotencyKey(crypto.randomUUID());}
 function toggle(){
  if(listening){controller.current?.stop();controller.current=null;setListening(false);return;}
  const provider=createBrowserSpeechProvider();
  if(!provider){setNotice("Speech recognition is unavailable in this browser. You can still type your note.");return;}
  controller.current=provider.start({
   language,
   onTranscript:value=>{setTranscript(current=>(current+" "+value).trim());setInputMode("speech");setReviewed(false);setSaved(false);setIdempotencyKey(crypto.randomUUID());},
   onStatus:status=>{setListening(status==="listening");if(status==="stopped")controller.current=null;},
   onError:message=>setNotice(message),
  });
  setNotice("Listening… review the transcript before continuing.");
 }
 return <section className="voice-workspace" aria-label="Voice workspace">
  <div className="voice-workspace-head"><div><span className="voice-kicker-dark"><Sparkles size={13}/> PHASE 2 · VOICE WORKSPACE</span><h2>Say it your way. Review before saving.</h2><p>Speak or type a shop note. This workspace can save a reviewed proposal; financial changes still require a separate billing confirmation.</p></div><span className="privacy-chip"><ShieldCheck size={14}/> No transaction is saved</span></div>
  <div className="voice-controls"><label>Recognition language<select value={language} onChange={e=>{setLanguage(e.target.value);setIdempotencyKey(crypto.randomUUID());setReviewed(false);setSaved(false);}}>{languages.map(([label,code])=><option key={code} value={code}>{label}</option>)}</select></label><button className={listening?"listen-button listening":"listen-button"} onClick={toggle}><span>{listening?<MicOff size={17}/>:<Mic size={17}/>}</span>{listening?"Stop listening":"Start speaking"}</button></div>
  <label className="transcript-label" htmlFor="voice-transcript">Transcript / typed note</label><textarea id="voice-transcript" value={transcript} onChange={e=>updateTranscript(e.target.value)} placeholder="Example: Ramesh 150 taka udhar, 2 kg sugar" rows={3}/>
  <p className="voice-notice" role="status">{notice}</p>
  {proposal?<div className="proposal-card"><div className="proposal-title"><strong>Suggested transaction</strong><span>REVIEW REQUIRED</span></div><div className="proposal-grid"><div><small>Customer</small><strong>{proposal.customerName}</strong></div><div><small>Credit amount</small><strong>{proposal.amount}</strong></div><div><small>Currency</small><strong>{proposal.currency??"Needs confirmation"}</strong></div><div><small>Items mentioned</small><strong>{proposal.items.length?proposal.items.map(i=>i.quantity+" "+i.unit+" "+i.name).join(", "):"Not detected"}</strong></div></div><p>{validation?.valid?"All required fields are present for a server-side review.":"Resolve these details before this proposal can proceed: "+validation?.issues.map(issue=>issue.message).join(" ")}</p><p>This voice proposal is not a transaction. Saving stores it for review only; it does not change the khata ledger, inventory or customer balance.</p><label className="voice-review-confirm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I reviewed the transcript, customer, amount, currency and detected items.</label><button type="button" className="voice-continue" disabled={!configured||!validation?.valid||!reviewed||saving} onClick={()=>void saveProposal()}>{saving?"Saving proposal…":"Save proposal for review"}</button>{saved&&<p className="auth-success" role="status">Proposal saved securely for review. No transaction was committed.</p>}{saveError&&<p className="auth-error" role="alert">{saveError}</p>}<button type="button" className="voice-continue secondary" onClick={onContinue}>Continue in billing workspace</button></div>:<div className="proposal-empty">A credit proposal appears when a customer, amount and udhar / credit cue are recognized.</div>}
  <div className="voice-safety"><ShieldCheck size={16}/><span><strong>Safe by design:</strong> voice output is untrusted input. This preview cannot save, bill, change stock or contact customers.</span></div>
 </section>;
}
