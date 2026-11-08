import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, BookOpen, Boxes, CreditCard, FileText, Search, ShoppingBag, Users } from "lucide-react";
import { useBusiness } from "../business/BusinessContext";
import { supabase } from "../lib/supabase";
import { rupeesToPaise } from "../domain/transaction";

type Props={active:string};
type Customer={id:string;name:string;phone:string;balance:number;last:string};
type Product={id:string;name:string;unit:string;stock:number;price:number};
type Entry={id:string;customer:string;detail:string;date:string;amount:number;reversal:boolean};
const sampleCustomers:Customer[]=[
{id:"s1",name:"Ramesh Kumar",phone:"+91 98765 43210",balance:245000,last:"Today, 10:18 AM"},
{id:"s2",name:"Ananya Stores",phone:"+91 98300 11223",balance:0,last:"Today, 11:42 AM"},
{id:"s3",name:"Maa Grocery",phone:"+91 99030 44556",balance:80000,last:"Yesterday"},
{id:"s4",name:"Rahul Das",phone:"+91 98100 77889",balance:45000,last:"Yesterday"}];
const sampleProducts:Product[]=[
{id:"p1",name:"Premium rice",unit:"kg",stock:42,price:6800},{id:"p2",name:"Sugar",unit:"kg",stock:8,price:4500},
{id:"p3",name:"Mustard oil",unit:"litre",stock:3,price:15500},{id:"p4",name:"Tea leaves",unit:"kg",stock:16,price:42000}];
const sampleEntries:Entry[]=[
{id:"e1",customer:"Ramesh Kumar",detail:"Credit sale · 2 kg sugar",date:"Today, 10:18 AM",amount:45000,reversal:false},
{id:"e2",customer:"Maa Grocery",detail:"Reversal",date:"Today, 9:56 AM",amount:-80000,reversal:true},
{id:"e3",customer:"Suman Enterprise",detail:"Credit sale · Rice & oil",date:"Yesterday",amount:520000,reversal:false}];
const money=(paise:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(paise/100);
const dateLabel=(value:string)=>new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
function Header({eyebrow,title,description,icon:Icon}:{eyebrow:string;title:string;description:string;icon:typeof Users}){return <div className="workspace-page-header"><div className="workspace-page-icon"><Icon size={20}/></div><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>;}
function Notice(){return <div className="demo-notice"><span className="live-dot"/> Preview data only · No records are saved</div>;}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <article className="workspace-metric"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>;}
function SearchBox({value,onChange,label}:{value:string;onChange:(v:string)=>void;label:string}){return <label className="workspace-search"><Search size={16}/><input aria-label={label} placeholder={"Search "+label.toLowerCase()+"..."} value={value} onChange={e=>onChange(e.target.value)}/></label>;}

function Customers(){
 const {business,configured}=useBusiness();
 const [rows,setRows]=useState<Customer[]>(configured?[]:sampleCustomers),[query,setQuery]=useState(""),[selected,setSelected]=useState(""),[adding,setAdding]=useState(false);
 const [name,setName]=useState(""),[phone,setPhone]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function load(){
  if(!supabase||!business)return;
  const [cs,ls]=await Promise.all([
   supabase.from("customers").select("id,display_name,phone_e164,created_at").eq("business_id",business.id).order("created_at",{ascending:false}),
   supabase.from("ledger_entries").select("customer_id,amount_paise,created_at").eq("business_id",business.id)
  ]);
  if(cs.error||ls.error){setError("Could not load customer records.");return;}
  const balances=new Map<string,number>(),last=new Map<string,string>();
  for(const x of ls.data??[]){balances.set(x.customer_id,(balances.get(x.customer_id)??0)+Number(x.amount_paise));const old=last.get(x.customer_id);if(!old||new Date(x.created_at)>new Date(old))last.set(x.customer_id,x.created_at);}
  setRows((cs.data??[]).map(x=>({id:x.id,name:x.display_name,phone:x.phone_e164??"Phone not added",balance:balances.get(x.id)??0,last:last.get(x.id)?dateLabel(last.get(x.id)!):"No activity yet"})));
 }
 useEffect(()=>{if(configured)void load();},[business?.id,configured]);
 useEffect(()=>{if(!selected&&rows[0])setSelected(rows[0].id);},[rows,selected]);
 const visible=useMemo(()=>rows.filter(x=>(x.name+" "+x.phone).toLowerCase().includes(query.toLowerCase())),[rows,query]);
 const current=rows.find(x=>x.id===selected);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase||!business)return;setBusy(true);setError("");
  const {error:e}=await supabase.functions.invoke("business-setup",{body:{action:"create_customer",business_id:business.id,display_name:name.trim(),phone_e164:phone.trim()||null}});
  if(e){setError("Customer could not be created. Check the phone format and retry.");setBusy(false);return;}
  setName("");setPhone("");setAdding(false);await load();setBusy(false);
 }
 return <>
  <Header eyebrow="CUSTOMER RELATIONSHIPS" title="Customers" description="Find customers and understand their account at a glance." icon={Users}/>
  {!configured&&<Notice/>}
  <div className="workspace-metrics"><Metric label="Total customers" value={String(configured?rows.length:128)} note={configured?"Live business records":"Sample shop data"}/><Metric label="With outstanding khata" value={String(rows.filter(x=>x.balance>0).length)} note="Calculated from ledger"/><Metric label="Total outstanding" value={money(rows.reduce((n,x)=>n+x.balance,0))} note={configured?"Live ledger total":"Demo figure"}/></div>
  <div className="workspace-two-column">
   <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Customer directory</h2><p>Search by customer name or phone.</p></div>{configured?<button className="subtle-button" onClick={()=>setAdding(!adding)}>{adding?"Cancel":"Add customer"}</button>:<span className="count-pill">{visible.length} shown</span>}</div>
    {adding&&<form className="inline-create-form" onSubmit={create}><label>Customer name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label><label>Phone (optional)<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+919876543210"/></label><button className="auth-submit" disabled={busy}>{busy?"Saving…":"Create customer"}</button></form>}
    {error&&<p className="auth-error" role="alert">{error}</p>}<SearchBox value={query} onChange={setQuery} label="Customers"/>
    <div className="workspace-record-list">{visible.map(x=><button key={x.id} className={selected===x.id?"workspace-record selected":"workspace-record"} onClick={()=>setSelected(x.id)}><span className="record-avatar">{x.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><span className="record-main"><strong>{x.name}</strong><small>{x.phone}</small></span><span className="record-amount">{money(x.balance)}<small>Customer</small></span></button>)}
    {!visible.length&&<div className="empty-inline">{configured?"No customers yet. Add your first customer above.":"No sample customers match your search."}</div>}</div>
   </section>
   <section className="workspace-panel customer-detail"><div className="workspace-panel-heading"><div><h2>Customer overview</h2><p>Selected customer summary.</p></div></div>
    {current?<><div className="customer-profile"><span className="record-avatar large">{current.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><div><strong>{current.name}</strong><small>{current.phone}</small></div></div><div className="customer-balance"><small>Outstanding balance</small><strong>{money(current.balance)}</strong><span>Last activity: {current.last}</span></div><div className="detail-row"><span>Account status</span><strong className="status-active">Active</strong></div><p className="detail-footnote">Balance is calculated from append-only ledger entries.</p></>:<div className="empty-inline">Select a customer to view their summary.</div>}
   </section>
  </div>
 </>;
}

function Ledger(){
 const {business,configured}=useBusiness();
 const [rows,setRows]=useState<Entry[]>(configured?[]:sampleEntries),[error,setError]=useState("");
 useEffect(()=>{
  if(!supabase||!business)return;let active=true;
  void (async()=>{
   const [ls,cs]=await Promise.all([
    supabase.from("ledger_entries").select("id,customer_id,entry_type,amount_paise,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(100),
    supabase.from("customers").select("id,display_name").eq("business_id",business.id)
   ]);
   if(!active)return;if(ls.error||cs.error){setError("Ledger history could not be loaded.");return;}
   const names=new Map((cs.data??[]).map(x=>[x.id,x.display_name]));
   setRows((ls.data??[]).map(x=>({id:x.id,customer:names.get(x.customer_id)??"Customer",detail:x.entry_type==="credit_sale"?"Credit sale":"Reversal",date:dateLabel(x.created_at),amount:Number(x.amount_paise),reversal:x.entry_type==="reversal"})));
  })();return()=>{active=false;};
 },[business?.id,configured]);
 const balance=rows.reduce((n,x)=>n+x.amount,0);
 return <>
  <Header eyebrow="CUSTOMER ACCOUNTS" title="Khata ledger" description="A clear, chronological view of credit and reversal activity." icon={BookOpen}/>{!configured&&<Notice/>}
  <div className="workspace-metrics"><Metric label="Outstanding balance" value={money(balance)} note={configured?"Live ledger balance":"Sample ledger total"}/><Metric label="Credit entries" value={String(rows.filter(x=>!x.reversal).length)} note="Credit sales"/><Metric label="Reversals" value={String(rows.filter(x=>x.reversal).length)} note="Compensating entries"/></div>
  <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Recent ledger activity</h2><p>Original records are never edited or deleted.</p></div><span className="count-pill">{rows.length} entries</span></div>{error&&<p className="auth-error" role="alert">{error}</p>}
   <div className="ledger-table"><div className="ledger-row ledger-head"><span>Customer / description</span><span>Date</span><span>Entry</span><span>Amount</span></div>{rows.map(x=><div className="ledger-row" key={x.id}><span className="ledger-person"><strong>{x.customer}</strong><small>{x.detail}</small></span><span>{x.date}</span><span><span className={x.reversal?"entry-chip payment-chip":"entry-chip credit-chip"}>{x.reversal?"Reversal":"Credit"}</span></span><strong className={x.reversal?"ledger-payment":"ledger-credit"}>{x.amount<0?"−":"+"}{money(Math.abs(x.amount))}</strong></div>)}</div>
   {!rows.length&&<div className="empty-inline">No ledger entries yet. Confirmed credit sales will appear here.</div>}<div className="ledger-footer"><span>Ledger history is append-only.</span><span>Corrections use linked reversals.</span></div>
  </section>
 </>;
}

function Inventory(){
 const {business,configured}=useBusiness();
 const [rows,setRows]=useState<Product[]>(configured?[]:sampleProducts),[query,setQuery]=useState(""),[adding,setAdding]=useState(false);
 const [name,setName]=useState(""),[unit,setUnit]=useState("kg"),[price,setPrice]=useState(""),[stock,setStock]=useState("0"),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function load(){
  if(!supabase||!business)return;
  const {data,error:e}=await supabase.from("products").select("id,name,unit_label,unit_price_paise,stock_on_hand").eq("business_id",business.id).eq("is_active",true).order("name");
  if(e){setError("Product catalogue could not be loaded.");return;}
  setRows((data??[]).map(x=>({id:x.id,name:x.name,unit:x.unit_label,stock:Number(x.stock_on_hand),price:Number(x.unit_price_paise)})));
 }
 useEffect(()=>{if(configured)void load();},[business?.id,configured]);
 const visible=rows.filter(x=>(x.name+" "+x.id).toLowerCase().includes(query.toLowerCase()));
 const low=rows.filter(x=>x.stock>0&&x.stock<=8).length,out=rows.filter(x=>x.stock===0).length;
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase||!business)return;
  const paise=rupeesToPaise(price),qty=Number(stock);
  if(paise===null||paise<=0){setError("Enter a valid rupee price with up to two decimals.");return;}
  if(!Number.isFinite(qty)||qty<0||!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(stock)){setError("Opening stock must be non-negative with up to three decimals.");return;}
  setBusy(true);setError("");
  const {error:e}=await supabase.functions.invoke("business-setup",{body:{action:"create_product",business_id:business.id,name:name.trim(),unit_label:unit,unit_price_paise:paise,opening_stock:qty}});
  if(e){setError("Product could not be created. Check the details and retry.");setBusy(false);return;}
  setName("");setPrice("");setStock("0");setAdding(false);await load();setBusy(false);
 }
 return <>
  <Header eyebrow="CATALOGUE & STOCK" title="Inventory" description="See what is in stock and spot products that need attention." icon={Boxes}/>{!configured&&<Notice/>}
  <div className="workspace-metrics"><Metric label="Active products" value={String(configured?rows.length:248)} note={configured?"Live catalogue":"Sample catalogue"}/><Metric label="Low stock" value={String(configured?low:3)} note="At or below reorder threshold"/><Metric label="Out of stock" value={String(configured?out:1)} note="Needs replenishment"/></div>
  <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Product catalogue</h2><p>Live stock levels and selling prices.</p></div>{configured?<button className="subtle-button" onClick={()=>setAdding(!adding)}>{adding?"Cancel":"Add product"}</button>:<span className="count-pill">{visible.length} shown</span>}</div>
   {adding&&<form className="inline-create-form product-form" onSubmit={create}><label>Product name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="Basmati rice"/></label><label>Unit<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="kg">kg</option><option value="litre">litre</option><option value="piece">piece</option><option value="packet">packet</option></select></label><label>Unit price (₹)<input required inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="150.00"/></label><label>Opening stock<input required inputMode="decimal" value={stock} onChange={e=>setStock(e.target.value)} placeholder="0"/></label><button className="auth-submit" disabled={busy}>{busy?"Saving…":"Create product"}</button></form>}
   {error&&<p className="auth-error" role="alert">{error}</p>}<SearchBox value={query} onChange={setQuery} label="Products"/>
   <div className="ledger-table inventory-table"><div className="ledger-row ledger-head"><span>Product</span><span>SKU / ID</span><span>Stock</span><span>Unit price</span></div>{visible.map(x=><div className="ledger-row" key={x.id}><span className="ledger-person"><strong>{x.name}</strong><small>Sold by {x.unit}</small></span><span>{x.id.slice(0,8).toUpperCase()}</span><span><span className={x.stock===0?"stock-chip out":x.stock<=8?"stock-chip low":"stock-chip healthy"}>{x.stock===0?"Out of stock":x.stock<=8?"Low · "+x.stock:x.stock+" "+x.unit}</span></span><strong>{money(x.price)}</strong></div>)}</div>
   {!visible.length&&<div className="empty-inline">{configured?"No products yet. Add your first product above.":"No sample products match your search."}</div>}
  </section>
 </>;
}

function Billing(){return <><Header eyebrow="SALES WORKSPACE" title="Sales & billing" description="Prepare itemised bills and review totals before issuing." icon={ShoppingBag}/><Notice/><div className="workspace-two-column"><section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Billing workflow</h2><p>Production billing will use live customer and catalogue data.</p></div></div><div className="workflow-steps"><div><span>1</span><strong>Select customer</strong><small>Resolve the correct customer account.</small></div><div><span>2</span><strong>Add items</strong><small>Confirm units, quantities and prices.</small></div><div><span>3</span><strong>Review bill</strong><small>Verify totals and payment method.</small></div><div><span>4</span><strong>Confirm</strong><small>Server validates and commits atomically.</small></div></div></section><section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Safety checks</h2><p>Required before a real sale is recorded.</p></div></div><div className="safety-check-list"><p><span>✓</span> Business membership verified</p><p><span>✓</span> Integer-paise money</p><p><span>✓</span> Stock checked in transaction</p><p><span>✓</span> Idempotent commits</p><p><span>✓</span> Append-only reversals</p></div><div className="detail-footnote">Billing confirmation UI is still under development.</div></section></div></>;}
function Payments(){return <><Header eyebrow="CASH FLOW" title="Payments" description="Track how customers settle outstanding balances." icon={CreditCard}/><Notice/><section className="workspace-panel empty-workspace"><CreditCard size={28}/><h2>Payment receipts are next</h2><p>Payment recording and reconciliation will follow the ledger receipt workflow.</p></section></>;}
export default function WorkspacePage({active}:Props){
 if(active==="Customers")return <Customers/>;
 if(active==="Khata ledger")return <Ledger/>;
 if(active==="Inventory")return <Inventory/>;
 if(active==="Sales & billing")return <Billing/>;
 if(active==="Payments")return <Payments/>;
 return <><Header eyebrow="WORKSPACE" title={active} description="This workspace is being prepared for the first connected pilot." icon={FileText}/><Notice/><section className="workspace-panel empty-workspace"><ShoppingBag size={28}/><h2>{active} is on the roadmap</h2><p>Core business data and transaction safety are being built before enabling this workflow.</p></section></>;
}
