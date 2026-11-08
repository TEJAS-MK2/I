import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, BookOpen, Boxes, CreditCard, FileText, Search, ShoppingBag, Users } from "lucide-react";
import { useBusiness } from "../business/BusinessContext";
import { supabase } from "../lib/supabase";
import { rupeesToPaise, validateCreditSale } from "../domain/transaction";

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

function Billing(){
 const {business,configured}=useBusiness();
 const [customers,setCustomers]=useState<{id:string;name:string}[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [customerId,setCustomerId]=useState(""),[productId,setProductId]=useState(""),[quantity,setQuantity]=useState("1");
 const [lines,setLines]=useState<{productId:string;name:string;unit:string;quantity:string;unitPricePaise:number}[]>([]);
 const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(configured),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [idempotencyKey,setIdempotencyKey]=useState(()=>crypto.randomUUID());
 useEffect(()=>{
  if(!supabase||!business)return;let active=true;setLoading(true);
  void Promise.all([
   supabase.from("customers").select("id,display_name").eq("business_id",business.id).order("display_name"),
   supabase.from("products").select("id,name,unit_label,unit_price_paise,stock_on_hand").eq("business_id",business.id).eq("is_active",true).order("name")
  ]).then(([cs,ps])=>{
   if(!active)return;
   if(cs.error||ps.error){setError("Customer or catalogue data could not be loaded.");}
   else{
    setCustomers((cs.data??[]).map(x=>({id:x.id,name:x.display_name})));
    setProducts((ps.data??[]).map(x=>({id:x.id,name:x.name,unit:x.unit_label,stock:Number(x.stock_on_hand),price:Number(x.unit_price_paise)})));
   }
   setLoading(false);
  });
  return()=>{active=false;};
 },[business?.id,configured]);
 const selectedProduct=products.find(x=>x.id===productId);
 const totalPaise=lines.reduce((sum,line)=>{
  const [whole,fraction=""]=line.quantity.split(".");
  const milli=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,"0"));
  return sum+(milli*BigInt(line.unitPricePaise))/1000n;
 },0n);
 const totalSafe=totalPaise<=BigInt(Number.MAX_SAFE_INTEGER);
 function changePayload(){setReviewed(false);setSuccess("");setIdempotencyKey(crypto.randomUUID());}
 function addLine(){
  if(!selectedProduct)return;
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(quantity)||Number(quantity)<=0){setError("Enter a quantity greater than zero with up to three decimal places.");return;}
  const [whole,fraction=""]=quantity.split(".");
  const milli=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,"0"));
  const lineMilliPaise=milli*BigInt(selectedProduct.price);
  if(lineMilliPaise%1000n!==0n){setError("This quantity and price would create a fractional paise. Adjust the quantity or price.");return;}
  const already=lines.filter(x=>x.productId===selectedProduct.id).reduce((sum,x)=>sum+Number(x.quantity),0);
  if(already+Number(quantity)>selectedProduct.stock){setError("Requested quantity exceeds the currently displayed stock.");return;}
  setLines(current=>[...current,{productId:selectedProduct.id,name:selectedProduct.name,unit:selectedProduct.unit,quantity,unitPricePaise:selectedProduct.price}]);
  setError("");changePayload();setQuantity("1");
 }
 function removeLine(index:number){setLines(current=>current.filter((_,i)=>i!==index));changePayload();}
 async function confirmSale(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase||!business||!customerId||!lines.length||!reviewed||!totalSafe)return;
  const command={businessId:business.id,customerId,amountPaise:Number(totalPaise),currency:"INR" as const,idempotencyKey,confirmed:true,items:lines.map(x=>({productId:x.productId,quantity:x.quantity,unitPricePaise:x.unitPricePaise}))};
  const issues=validateCreditSale(command);
  if(issues.length){setError(issues.map(x=>x.message).join(" "));return;}
  setBusy(true);setError("");setSuccess("");
  const {data,error:invokeError}=await supabase.functions.invoke("record-credit-sale",{body:{
   business_id:business.id,customer_id:customerId,amount_paise:Number(totalPaise),currency:"INR",
   idempotency_key:idempotencyKey,confirmed:true,
   items:lines.map(x=>({product_id:x.productId,quantity:Number(x.quantity),unit_price_paise:x.unitPricePaise}))
  }});
  if(invokeError){setError("Sale was not confirmed by the server. Review stock and prices before retrying. The same request key is retained for a safe retry.");setBusy(false);return;}
  const transactionId=data?.result?.transaction_id;
  setSuccess("Credit sale recorded. Ledger and inventory were updated atomically."+ (transactionId?" Reference: "+transactionId:""));
  setLines([]);setReviewed(false);setIdempotencyKey(crypto.randomUUID());setBusy(false);
  const refreshed=await supabase.from("products").select("id,name,unit_label,unit_price_paise,stock_on_hand").eq("business_id",business.id).eq("is_active",true).order("name");
  if(!refreshed.error)setProducts((refreshed.data??[]).map(x=>({id:x.id,name:x.name,unit:x.unit_label,stock:Number(x.stock_on_hand),price:Number(x.unit_price_paise)})));
 }
 if(!configured)return <><Header eyebrow="SALES WORKSPACE" title="Sales & billing" description="Prepare itemised bills and review totals before issuing." icon={ShoppingBag}/><Notice/><section className="workspace-panel empty-workspace"><ShoppingBag size={28}/><h2>Billing preview</h2><p>Connect the dedicated backend environment to enable customer selection, live prices, stock checks and explicit sale confirmation.</p></section></>;
 return <>
  <Header eyebrow="SALES WORKSPACE" title="Sales & billing" description="Prepare a credit sale, review every line and explicitly confirm before saving." icon={ShoppingBag}/>
  <div className="demo-notice"><span className="live-dot"/> Live business data · Sale writes require explicit review and confirmation</div>
  {loading?<div className="workspace-panel empty-inline">Loading customers and catalogue…</div>:<form className="billing-layout" onSubmit={confirmSale}>
   <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Build credit sale</h2><p>Prices and stock are loaded from your business catalogue.</p></div><span className="count-pill">INR · paise-safe</span></div>
    <label className="billing-field">Customer<select required value={customerId} onChange={e=>{setCustomerId(e.target.value);changePayload();}}><option value="">Choose a customer…</option>{customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <div className="billing-add-row"><label className="billing-field">Product<select value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Choose product…</option>{products.map(x=><option key={x.id} value={x.id} disabled={x.stock<=0}>{x.name} · {money(x.price)} / {x.unit} · stock {x.stock}</option>)}</select></label><label className="billing-field quantity-field">Quantity<input inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="1.000"/></label><button type="button" className="subtle-button add-line-button" disabled={!selectedProduct||selectedProduct.stock<=0} onClick={addLine}>Add item</button></div>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <div className="billing-lines"><div className="billing-line billing-line-head"><span>Item</span><span>Qty</span><span>Unit price</span><span>Line total</span><span/></div>{lines.map((line,index)=>{
      const [whole,fraction=""]=line.quantity.split("."),milli=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,"0"));
      const lineTotal=Number((milli*BigInt(line.unitPricePaise))/1000n);
      return <div className="billing-line" key={line.productId+"-"+index}><span><strong>{line.name}</strong><small>per {line.unit}</small></span><span>{line.quantity} {line.unit}</span><span>{money(line.unitPricePaise)}</span><strong>{money(lineTotal)}</strong><button type="button" aria-label={"Remove "+line.name} onClick={()=>removeLine(index)}>×</button></div>;
    })}{!lines.length&&<div className="empty-inline">Add confirmed products to build the bill.</div>}</div>
    <div className="billing-total"><span>Credit sale total</span><strong>{totalSafe?money(Number(totalPaise)):"Amount too large"}</strong></div>
   </section>
   <aside className="workspace-panel billing-review"><div className="workspace-panel-heading"><div><h2>Review & confirm</h2><p>Nothing is saved until you confirm.</p></div></div>
    <div className="review-row"><span>Customer</span><strong>{customers.find(x=>x.id===customerId)?.name??"Not selected"}</strong></div>
    <div className="review-row"><span>Items</span><strong>{lines.length}</strong></div>
    <div className="review-row"><span>Currency</span><strong>INR</strong></div>
    <div className="review-total"><small>Amount to add to khata</small><strong>{totalSafe?money(Number(totalPaise)):"—"}</strong></div>
    <label className="confirm-review"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>I have checked the customer, quantities, unit prices and total. I confirm this credit sale.</span></label>
    <button className="auth-submit confirm-sale-button" disabled={busy||!customerId||!lines.length||!reviewed||!totalSafe}>{busy?"Saving securely…":"Confirm credit sale"}</button>
    <p className="detail-footnote">The server rechecks membership, catalogue prices, stock, totals and idempotency inside one database transaction.</p>
    {success&&<p className="auth-success" role="status">{success}</p>}
   </aside>
  </form>}
  {!customers.length&&!loading&&<p className="detail-footnote">Add a customer before creating a credit sale. The customer directory is available in the Customers workspace.</p>}
 </>;
}
function Payments(){
 const {business,configured}=useBusiness();
 const [customers,setCustomers]=useState<{id:string;name:string;balance:number}[]>([]);
 const [records,setRecords]=useState<{id:string;customer:string;amount:number;method:string;date:string;reversed:boolean}[]>([]);
 const [customerId,setCustomerId]=useState(""),[amount,setAmount]=useState(""),[method,setMethod]=useState("cash"),[reviewed,setReviewed]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(configured),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [key,setKey]=useState(()=>crypto.randomUUID()),[confirmingId,setConfirmingId]=useState("");
 async function load(){
  if(!supabase||!business)return;
  const [cs,ls,ts]=await Promise.all([
   supabase.from("customers").select("id,display_name").eq("business_id",business.id).order("display_name"),
   supabase.from("ledger_entries").select("id,customer_id,transaction_id,entry_type,amount_paise,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(200),
   supabase.from("business_transactions").select("id,transaction_type,payment_method,reversal_of").eq("business_id",business.id)
  ]);
  if(cs.error||ls.error||ts.error){setError("Payment history could not be loaded.");return;}
  const names=new Map((cs.data??[]).map(x=>[x.id,x.display_name]));
  const balances=new Map<string,number>();
  for(const row of ls.data??[])balances.set(row.customer_id,(balances.get(row.customer_id)??0)+Number(row.amount_paise));
  setCustomers((cs.data??[]).map(x=>({id:x.id,name:x.display_name,balance:balances.get(x.id)??0})));
  const reversed=new Set((ts.data??[]).filter(x=>x.transaction_type==="reversal"&&x.reversal_of).map(x=>x.reversal_of));
  const methods=new Map((ts.data??[]).filter(x=>x.transaction_type==="payment").map(x=>[x.id,x.payment_method??"other"]));
  setRecords((ls.data??[]).filter(x=>x.entry_type==="payment").map(x=>({id:x.transaction_id,customer:names.get(x.customer_id)??"Customer",amount:Math.abs(Number(x.amount_paise)),method:methods.get(x.transaction_id)??"other",date:dateLabel(x.created_at),reversed:reversed.has(x.transaction_id)})));
 }
 useEffect(()=>{if(configured){setLoading(true);void load().finally(()=>setLoading(false));}},[business?.id,configured]);
 const selected=customers.find(x=>x.id===customerId);
 function change(){setReviewed(false);setSuccess("");setKey(crypto.randomUUID());}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase||!business||!selected||!reviewed)return;
  const paise=rupeesToPaise(amount);
  if(paise===null||paise<=0||paise>selected.balance){setError("Enter a valid payment amount no greater than the outstanding balance.");return;}
  setBusy(true);setError("");setSuccess("");
  const {error:e}=await supabase.functions.invoke("record-customer-payment",{body:{business_id:business.id,customer_id:customerId,amount_paise:paise,currency:"INR",idempotency_key:key,payment_method:method,confirmed:true}});
  if(e){setError("Payment was not accepted. Review the current balance before retrying; the same request key is retained for a safe retry.");setBusy(false);return;}
  setSuccess("Payment recorded and customer balance updated.");
  setAmount("");setReviewed(false);setKey(crypto.randomUUID());await load();setBusy(false);
 }
 async function reversePayment(transactionId:string){
  if(!supabase||!business)return;
  setBusy(true);setError("");setSuccess("");
  const {error:e}=await supabase.functions.invoke("reverse-customer-payment",{body:{business_id:business.id,original_transaction_id:transactionId,idempotency_key:crypto.randomUUID(),confirmed:true}});
  if(e){setError("Payment reversal was rejected. Check the payment status and permissions.");setBusy(false);return;}
  setSuccess("Payment reversed. The original receipt remains in the ledger.");
  setConfirmingId("");await load();setBusy(false);
 }
 if(!configured)return <><Header eyebrow="CASH FLOW" title="Payments" description="Track how customers settle outstanding balances." icon={CreditCard}/><Notice/><section className="workspace-panel empty-workspace"><CreditCard size={28}/><h2>Payment preview</h2><p>Connect the dedicated backend environment to record receipts and reconcile customer balances.</p></section></>;
 return <>
  <Header eyebrow="CASH FLOW" title="Payments" description="Record customer receipts and keep their khata balances accurate." icon={CreditCard}/>
  <div className="demo-notice"><span className="live-dot"/> Live business data · Payment entries are append-only</div>
  <div className="workspace-two-column payment-layout">
   <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Record a payment</h2><p>Accept a cash, UPI or bank receipt against an outstanding balance.</p></div></div>
    {loading?<div className="empty-inline">Loading customer balances…</div>:<form className="payment-form" onSubmit={submit}>
     <label className="billing-field">Customer<select required value={customerId} onChange={e=>{setCustomerId(e.target.value);change();}}><option value="">Choose a customer…</option>{customers.filter(x=>x.balance>0).map(x=><option key={x.id} value={x.id}>{x.name} · {money(x.balance)} due</option>)}</select></label>
     <div className="review-total"><small>Current outstanding</small><strong>{selected?money(selected.balance):"—"}</strong></div>
     <label className="billing-field">Amount received (₹)<input required inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);change();}} placeholder="0.00"/></label>
     <label className="billing-field">Payment method<select value={method} onChange={e=>{setMethod(e.target.value);change();}}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="other">Other</option></select></label>
     <label className="confirm-review"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>I have verified the customer, amount and payment method. Record this receipt.</span></label>
     {error&&<p className="auth-error" role="alert">{error}</p>}
     <button className="auth-submit" disabled={busy||!selected||!amount||!reviewed}>{busy?"Saving securely…":"Confirm payment received"}</button>
    </form>}
    {success&&<p className="auth-success" role="status">{success}</p>}
    {!customers.some(x=>x.balance>0)&&!loading&&<div className="empty-inline">No customer balances are currently outstanding.</div>}
   </section>
   <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Recent receipts</h2><p>Payment reversals preserve the original receipt.</p></div><span className="count-pill">{records.length} receipts</span></div>
    {records.slice(0,12).map(row=><div className="payment-record" key={row.id}><div className="transaction-icon payment"><ArrowDownLeft size={17}/></div><div className="transaction-info"><strong>{row.customer}</strong><small>{row.method.toUpperCase()} · {row.date}</small></div><div className="payment-record-amount"><strong>{money(row.amount)}</strong>{row.reversed?<small className="reversed-label">Reversed</small>:business?.role==="owner"||business?.role==="admin"?<button className="text-action" onClick={()=>setConfirmingId(confirmingId===row.id?"":row.id)}>{confirmingId===row.id?"Cancel":"Reverse"}</button>:null}</div>
     {confirmingId===row.id&&!row.reversed&&<div className="payment-reversal-confirm"><span>This adds the payment amount back to the customer's outstanding balance.</span><button disabled={busy} onClick={()=>void reversePayment(row.id)}>Confirm reversal</button></div>}
    </div>)}
    {!records.length&&!loading&&<div className="empty-inline">No payments have been recorded yet.</div>}
   </section>
  </div>
 </>;
}
export default function WorkspacePage({active}:Props){
 if(active==="Customers")return <Customers/>;
 if(active==="Khata ledger")return <Ledger/>;
 if(active==="Inventory")return <Inventory/>;
 if(active==="Sales & billing")return <Billing/>;
 if(active==="Payments")return <Payments/>;
 return <><Header eyebrow="WORKSPACE" title={active} description="This workspace is being prepared for the first connected pilot." icon={FileText}/><Notice/><section className="workspace-panel empty-workspace"><ShoppingBag size={28}/><h2>{active} is on the roadmap</h2><p>Core business data and transaction safety are being built before enabling this workflow.</p></section></>;
}
