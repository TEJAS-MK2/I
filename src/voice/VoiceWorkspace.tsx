import {useEffect,useRef,useState} from "react";
import {Mic,MicOff,ShieldCheck,Sparkles} from "lucide-react";
import {parseKhataUtterance} from "./proposal";
import {validateKhataProposal} from "./transactionValidation";
import {createBrowserSpeechProvider} from "./speech";

const languages=[["Hinglish / Hindi","hi-IN"],["Bengali","bn-IN"],["English (India)","en-IN"],["Tamil","ta-IN"],["Telugu","te-IN"],["Marathi","mr-IN"],["Gujarati","gu-IN"],["Kannada","kn-IN"],["Malayalam","ml-IN"],["Punjabi","pa-IN"]];
export default function VoiceWorkspace({onContinue}:{onContinue?:()=>void}){
 const [language,setLanguage]=useState("hi-IN"),[transcript,setTranscript]=useState(""),[listening,setListening]=useState(false),[notice,setNotice]=useState("Choose a language and speak, or type a note below.");
 const controller=useRef<{stop:()=>void}|null>(null),proposal=parseKhataUtterance(transcript),validation=proposal?validateKhataProposal(proposal):null;
 useEffect(()=>()=>controller.current?.stop(),[]);
 function toggle(){
  if(listening){controller.current?.stop();controller.current=null;setListening(false);return;}
  const provider=createBrowserSpeechProvider();
  if(!provider){setNotice("Speech recognition is unavailable in this browser. You can still type your note.");return;}
  controller.current=provider.start({
   language,
   onTranscript:value=>setTranscript(current=>(current+" "+value).trim()),
   onStatus:status=>{setListening(status==="listening");if(status==="stopped")controller.current=null;},
   onError:message=>setNotice(message),
  });
  setNotice("Listening… review the transcript before continuing.");
 }
 return <section className="voice-workspace" aria-label="Voice workspace">
  <div className="voice-workspace-head"><div><span className="voice-kicker-dark"><Sparkles size={13}/> PHASE 2 · VOICE WORKSPACE</span><h2>Say it your way. Review before saving.</h2><p>Speak or type a shop note. This preview creates a proposal only.</p></div><span className="privacy-chip"><ShieldCheck size={14}/> No transaction is saved</span></div>
  <div className="voice-controls"><label>Recognition language<select value={language} onChange={e=>setLanguage(e.target.value)}>{languages.map(([label,code])=><option key={code} value={code}>{label}</option>)}</select></label><button className={listening?"listen-button listening":"listen-button"} onClick={toggle}><span>{listening?<MicOff size={17}/>:<Mic size={17}/>}</span>{listening?"Stop listening":"Start speaking"}</button></div>
  <label className="transcript-label" htmlFor="voice-transcript">Transcript / typed note</label><textarea id="voice-transcript" value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="Example: Ramesh 150 taka udhar, 2 kg sugar" rows={3}/>
  <p className="voice-notice" role="status">{notice}</p>
  {proposal?<div className="proposal-card"><div className="proposal-title"><strong>Suggested transaction</strong><span>REVIEW REQUIRED</span></div><div className="proposal-grid"><div><small>Customer</small><strong>{proposal.customerName}</strong></div><div><small>Credit amount</small><strong>{proposal.amount}</strong></div><div><small>Currency</small><strong>{proposal.currency??"Needs confirmation"}</strong></div><div><small>Items mentioned</small><strong>{proposal.items.length?proposal.items.map(i=>i.quantity+" "+i.unit+" "+i.name).join(", "):"Not detected"}</strong></div></div><p>{validation?.valid?"All required fields are present for a server-side review.":"Resolve these details before this proposal can proceed: "+validation?.issues.map(issue=>issue.message).join(" ")}</p><p>This voice proposal is not a transaction. Confirm the real customer and catalogue items in billing; the server will recheck current prices and stock before any commit.</p><button type="button" className="voice-continue" onClick={onContinue}>Continue in billing workspace</button></div>:<div className="proposal-empty">A credit proposal appears when a customer, amount and udhar / credit cue are recognized.</div>}
  <div className="voice-safety"><ShieldCheck size={16}/><span><strong>Safe by design:</strong> voice output is untrusted input. This preview cannot save, bill, change stock or contact customers.</span></div>
 </section>;
}
