import { useMemo, useState } from "react";
import { ArrowDownLeft, BookOpen, Boxes, CreditCard, FileText, Search, ShoppingBag, Users } from "lucide-react";

type WorkspacePageProps = { active: string };

const customers = [
  { name: "Ramesh Kumar", phone: "+91 98765 43210", outstanding: 2450, lastActivity: "Today, 10:18 AM", tag: "Regular" },
  { name: "Ananya Stores", phone: "+91 98300 11223", outstanding: 0, lastActivity: "Today, 11:42 AM", tag: "Wholesale" },
  { name: "Maa Grocery", phone: "+91 99030 44556", outstanding: 800, lastActivity: "Yesterday", tag: "Regular" },
  { name: "Rahul Das", phone: "+91 98100 77889", outstanding: 450, lastActivity: "Yesterday", tag: "Regular" },
  { name: "Suman Enterprise", phone: "+91 98311 22334", outstanding: 5200, lastActivity: "6 Nov 2026", tag: "Wholesale" },
];
const products = [
  { name: "Premium rice", sku: "SKU-001", unit: "kg", stock: 42, price: 6800 },
  { name: "Sugar", sku: "SKU-002", unit: "kg", stock: 8, price: 4500 },
  { name: "Mustard oil", sku: "SKU-003", unit: "litre", stock: 3, price: 15500 },
  { name: "Tea leaves", sku: "SKU-004", unit: "kg", stock: 16, price: 42000 },
  { name: "Atta", sku: "SKU-005", unit: "kg", stock: 0, price: 3800 },
];
const ledger = [
  { customer: "Ramesh Kumar", detail: "Credit sale · 2 kg sugar", date: "Today, 10:18 AM", amount: 45000, kind: "credit" },
  { customer: "Maa Grocery", detail: "Payment received · UPI", date: "Today, 9:56 AM", amount: 80000, kind: "payment" },
  { customer: "Suman Enterprise", detail: "Credit sale · Rice & oil", date: "Yesterday, 5:20 PM", amount: 520000, kind: "credit" },
  { customer: "Rahul Das", detail: "Credit sale · Grocery items", date: "Yesterday, 2:15 PM", amount: 45000, kind: "credit" },
];

const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);

function PageHeader({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: typeof Users }) {
  return <div className="workspace-page-header"><div className="workspace-page-icon"><Icon size={20}/></div><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>;
}
function DemoNotice() {
  return <div className="demo-notice"><span className="live-dot"/> Preview data only · No customer or financial records are saved</div>;
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="workspace-metric"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>;
}

function CustomerDirectory() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(customers[0].name);
  const visible = useMemo(() => customers.filter(c => (c.name + " " + c.phone).toLowerCase().includes(query.toLowerCase())), [query]);
  const customer = customers.find(c => c.name === selected);
  return <>
    <PageHeader eyebrow="CUSTOMER RELATIONSHIPS" title="Customers" description="Find customers and understand their account at a glance." icon={Users}/>
    <DemoNotice/>
    <div className="workspace-metrics"><Metric label="Total customers" value="128" note="Across this sample shop"/><Metric label="With outstanding khata" value="14" note="Sample customer balances"/><Metric label="Total outstanding" value="₹8,450" note="Demo figure only"/></div>
    <div className="workspace-two-column">
      <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Customer directory</h2><p>Search by customer name or phone number.</p></div><span className="count-pill">{visible.length} shown</span></div><label className="workspace-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customers..." aria-label="Search customers"/></label>
        <div className="workspace-record-list">{visible.map(c=><button key={c.name} className={selected===c.name?"workspace-record selected":"workspace-record"} onClick={()=>setSelected(c.name)}><span className="record-avatar">{c.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><span className="record-main"><strong>{c.name}</strong><small>{c.phone}</small></span><span className="record-amount">{money(c.outstanding*100)}<small>{c.tag}</small></span></button>)}</div>
      </section>
      <section className="workspace-panel customer-detail"><div className="workspace-panel-heading"><div><h2>Customer overview</h2><p>Selected customer summary.</p></div></div>
        {customer ? <><div className="customer-profile"><span className="record-avatar large">{customer.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><div><strong>{customer.name}</strong><small>{customer.phone}</small></div></div><div className="customer-balance"><small>Outstanding balance</small><strong>{money(customer.outstanding*100)}</strong><span>Last activity: {customer.lastActivity}</span></div><div className="detail-row"><span>Customer type</span><strong>{customer.tag}</strong></div><div className="detail-row"><span>Account status</span><strong className="status-active">Active (sample)</strong></div><p className="detail-footnote">A real account statement will be available after the hosted database and customer ledger screens are connected.</p></> : <p>Select a customer to view their summary.</p>}
      </section>
    </div>
  </>;
}

function LedgerWorkspace() {
  return <>
    <PageHeader eyebrow="CUSTOMER ACCOUNTS" title="Khata ledger" description="A clear, chronological view of credit and payment activity." icon={BookOpen}/>
    <DemoNotice/>
    <div className="workspace-metrics"><Metric label="Outstanding balance" value="₹8,450" note="Sample ledger total"/><Metric label="Credit entries" value="24" note="This month · demo"/><Metric label="Payments received" value="₹18,600" note="This month · demo"/></div>
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Recent ledger activity</h2><p>Credit increases the balance; payments reduce it.</p></div><span className="count-pill">Latest 4</span></div>
      <div className="ledger-table"><div className="ledger-row ledger-head"><span>Customer / description</span><span>Date</span><span>Entry</span><span>Amount</span></div>{ledger.map((entry,i)=><div className="ledger-row" key={entry.customer+i}><span className="ledger-person"><strong>{entry.customer}</strong><small>{entry.detail}</small></span><span>{entry.date}</span><span><span className={entry.kind==="credit"?"entry-chip credit-chip":"entry-chip payment-chip"}>{entry.kind==="credit"?"Credit":"Payment"}</span></span><strong className={entry.kind==="credit"?"ledger-credit":"ledger-payment"}>{entry.kind==="credit"?"+":"−"}{money(entry.amount)}</strong></div>)}</div>
      <div className="ledger-footer"><span>Ledger history is append-only.</span><span>Corrections use linked reversals.</span></div>
    </section>
  </>;
}

function InventoryWorkspace() {
  const [query,setQuery]=useState("");
  const visible=products.filter(p=>(p.name+" "+p.sku).toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader eyebrow="CATALOGUE & STOCK" title="Inventory" description="See what is in stock and spot products that need attention." icon={Boxes}/>
    <DemoNotice/>
    <div className="workspace-metrics"><Metric label="Active products" value="248" note="Sample catalogue"/><Metric label="Low stock" value="3" note="At or below reorder level"/><Metric label="Out of stock" value="1" note="Needs replenishment"/></div>
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Product catalogue</h2><p>Sample stock levels and selling prices.</p></div><span className="count-pill">{visible.length} products</span></div><label className="workspace-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products or SKU..." aria-label="Search products"/></label>
      <div className="ledger-table inventory-table"><div className="ledger-row ledger-head"><span>Product</span><span>SKU</span><span>Stock</span><span>Unit price</span></div>{visible.map(p=><div className="ledger-row" key={p.sku}><span className="ledger-person"><strong>{p.name}</strong><small>Sold by {p.unit}</small></span><span>{p.sku}</span><span><span className={p.stock===0?"stock-chip out":p.stock<=8?"stock-chip low":"stock-chip healthy"}>{p.stock===0?"Out of stock":p.stock<=8?"Low · "+p.stock:p.stock+" "+p.unit}</span></span><strong>{money(p.price)}</strong></div>)}</div>
    </section>
  </>;
}

function BillingWorkspace() {
  return <>
    <PageHeader eyebrow="SALES WORKSPACE" title="Sales & billing" description="Prepare clear itemised bills and review totals before issuing." icon={ShoppingBag}/>
    <DemoNotice/>
    <div className="workspace-two-column">
      <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Billing workflow</h2><p>Production billing will use live catalogue and stock data.</p></div></div><div className="workflow-steps"><div><span>1</span><strong>Select customer</strong><small>Resolve the correct customer account.</small></div><div><span>2</span><strong>Add items</strong><small>Confirm units, quantities and current prices.</small></div><div><span>3</span><strong>Review bill</strong><small>Verify totals, taxes and payment method.</small></div><div><span>4</span><strong>Confirm</strong><small>Server validates and commits atomically.</small></div></div></section>
      <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Safety checks</h2><p>Required before a real sale can be recorded.</p></div></div><div className="safety-check-list"><p><span>✓</span> Customer and business membership verified</p><p><span>✓</span> Money stored as integer paise</p><p><span>✓</span> Stock availability checked in transaction</p><p><span>✓</span> Idempotency prevents duplicate commits</p><p><span>✓</span> Reversal preserves original history</p></div><div className="detail-footnote">The billing form is intentionally not active until a dedicated backend environment is configured.</div></section>
    </div>
  </>;
}

function PaymentsWorkspace() {
  return <>
    <PageHeader eyebrow="CASH FLOW" title="Payments" description="Track how customers settle outstanding balances." icon={CreditCard}/>
    <DemoNotice/>
    <div className="workspace-metrics"><Metric label="Received today" value="₹2,450" note="Sample payments"/><Metric label="UPI payments" value="₹1,850" note="Demo amount"/><Metric label="Cash payments" value="₹600" note="Demo amount"/></div>
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Payment activity</h2><p>Sample payment events. Live reconciliation is not connected.</p></div></div>{ledger.filter(e=>e.kind==="payment").map(e=><div className="transaction" key={e.customer}><div className="transaction-icon payment"><ArrowDownLeft size={17}/></div><div className="transaction-info"><strong>{e.customer}</strong><small>{e.detail} · {e.date}</small></div><strong className="amount">{money(e.amount)}</strong></div>)}</section>
  </>;
}

export default function WorkspacePage({ active }: WorkspacePageProps) {
  if (active === "Customers") return <CustomerDirectory/>;
  if (active === "Khata ledger") return <LedgerWorkspace/>;
  if (active === "Inventory") return <InventoryWorkspace/>;
  if (active === "Sales & billing") return <BillingWorkspace/>;
  if (active === "Payments") return <PaymentsWorkspace/>;
  return <>
    <PageHeader eyebrow="WORKSPACE" title={active} description="This workspace is being prepared for the first connected pilot." icon={FileText}/>
    <DemoNotice/>
    <section className="workspace-panel empty-workspace"><ShoppingBag size={28}/><h2>{active} is on the roadmap</h2><p>Core business data and transaction safety are being built before enabling this workflow.</p></section>
  </>;
}
