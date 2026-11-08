import { useEffect, useState, type FormEvent } from "react";
import { Activity, ArrowUpRight, BarChart3, MessageCircle, Truck } from "lucide-react";
import { useBusiness } from "../business/BusinessContext";
import { supabase } from "../lib/supabase";
import { rupeesToPaise } from "../domain/transaction";

type Delivery = {
  id: string;
  reference_code: string;
  recipient_name: string;
  delivery_address: string;
  status: string;
  delivery_fee_paise: number;
  cash_to_collect_paise: number;
  created_at: string;
};
type CustomerOption = { id: string; display_name: string };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
const dateLabel = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function PageHeader({ icon: Icon, eyebrow, title, description }: {
  icon: typeof Truck; eyebrow: string; title: string; description: string;
}) {
  return <div className="workspace-page-header"><div className="workspace-page-icon"><Icon size={20}/></div><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>;
}

export function LogisticsPage() {
  const { business, configured } = useBusiness();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [reference, setReference] = useState("");
  const [recipient, setRecipient] = useState("");
  const [address, setAddress] = useState("");
  const [fee, setFee] = useState("0");
  const [cash, setCash] = useState("0");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function load() {
    if (!supabase || !business) return;
    const { data, error: loadError } = await supabase.from("delivery_jobs")
      .select("id,reference_code,recipient_name,delivery_address,status,delivery_fee_paise,cash_to_collect_paise,created_at")
      .eq("business_id", business.id).order("created_at", { ascending: false }).limit(50);
    if (loadError) { setError("Delivery records could not be loaded."); return; }
    setRows((data ?? []) as Delivery[]);
  }
  useEffect(() => { if (configured) void load(); }, [business?.id, configured]);

  async function createDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !business || !confirmed) return;
    const feePaise = rupeesToPaise(fee);
    const cashPaise = rupeesToPaise(cash);
    if (feePaise === null || cashPaise === null || feePaise < 0 || cashPaise < 0) {
      setError("Enter valid non-negative amounts in rupees."); return;
    }
    setBusy(true); setError(""); setSuccess("");
    const { error: invokeError } = await supabase.functions.invoke("delivery-operations", {
      body: {
        action: "create", business_id: business.id, customer_id: null,
        reference_code: reference.trim(), recipient_name: recipient.trim(),
        recipient_phone: null, delivery_address: address.trim(),
        delivery_fee_paise: feePaise, cash_to_collect_paise: cashPaise,
        idempotency_key: idempotencyKey, confirmed: true,
      },
    });
    if (invokeError) {
      setError("Delivery could not be created. Review the details and retry with the same request key.");
      setBusy(false); return;
    }
    setSuccess("Delivery job created.");
    setReference(""); setRecipient(""); setAddress(""); setFee("0"); setCash("0");
    setConfirmed(false); setIdempotencyKey(crypto.randomUUID());
    await load(); setBusy(false);
  }

  async function advanceDelivery(job: Delivery) {
    if (!supabase || !business) return;
    const next = job.status === "queued" ? "assign to yourself" :
      job.status === "assigned" ? "mark as picked up" :
      job.status === "picked_up" ? "mark in transit" :
      job.status === "in_transit" ? "mark as delivered" : "";
    if (!next || !window.confirm(`Confirm: ${next} for ${job.reference_code}?`)) return;
    setBusy(true); setError(""); setSuccess("");
    let body: Record<string, unknown>;
    if (job.status === "queued") {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { setError("A signed-in shop member is required to assign this delivery."); setBusy(false); return; }
      body = { action: "assign", business_id: business.id, delivery_job_id: job.id, assigned_user_id: auth.user.id, confirmed: true };
    } else {
      const event = job.status === "assigned" ? "picked_up" : job.status === "picked_up" ? "in_transit" : "delivered";
      body = { action: "event", business_id: business.id, delivery_job_id: job.id, event_type: event, confirmed: true };
    }
    const { error: invokeError } = await supabase.functions.invoke("delivery-operations", { body });
    if (invokeError) setError("The delivery update was rejected. Check the assignment and current status.");
    else setSuccess(`Delivery ${job.reference_code} updated.`);
    await load(); setBusy(false);
  }

  return <>
    <PageHeader icon={Truck} eyebrow="LOCAL OPERATIONS" title="Deliveries" description="Create local delivery jobs, assign work and follow each hand-off."/>
    {!configured && <div className="demo-notice"><span className="live-dot"/> Preview mode · Connect the dedicated backend to save delivery jobs.</div>}
    <div className="operations-grid">
      <section className="workspace-panel">
        <div className="workspace-panel-heading"><div><h2>New delivery</h2><p>Record the recipient, destination and collection amount.</p></div><span className="count-pill">INR · paise-safe</span></div>
        <form className="operations-form" onSubmit={createDelivery}>
          <label>Reference code<input required maxLength={64} value={reference} onChange={e=>{setReference(e.target.value);setIdempotencyKey(crypto.randomUUID());}} placeholder="DLV-001"/></label>
          <label>Recipient name<input required maxLength={120} value={recipient} onChange={e=>{setRecipient(e.target.value);setIdempotencyKey(crypto.randomUUID());}} placeholder="Customer name"/></label>
          <label className="full-field">Delivery address<textarea required maxLength={500} value={address} onChange={e=>{setAddress(e.target.value);setIdempotencyKey(crypto.randomUUID());}} placeholder="House, street, area and landmark"/></label>
          <label>Delivery fee (₹)<input required inputMode="decimal" value={fee} onChange={e=>{setFee(e.target.value);setIdempotencyKey(crypto.randomUUID());}}/></label>
          <label>Cash to collect (₹)<input required inputMode="decimal" value={cash} onChange={e=>{setCash(e.target.value);setIdempotencyKey(crypto.randomUUID());}}/></label>
          <label className="operations-confirm full-field"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I reviewed the delivery details and confirm this job.</label>
          {error && <p className="auth-error full-field" role="alert">{error}</p>}
          <button className="auth-submit full-field" disabled={!configured||busy||!confirmed}>{busy?"Saving…":"Create delivery job"}</button>
        </form>
        {success && <p className="auth-success" role="status">{success}</p>}
      </section>
      <section className="workspace-panel">
        <div className="workspace-panel-heading"><div><h2>Delivery queue</h2><p>Move jobs through their confirmed status steps.</p></div><span className="count-pill">{rows.length} jobs</span></div>
        {!configured ? <div className="empty-inline">Delivery queue will appear here when a backend is connected.</div> :
          rows.length ? <div className="operations-list">{rows.map(job=><article className="operation-record" key={job.id}>
            <div className="operation-record-top"><strong>{job.reference_code}</strong><span className="status-pill">{job.status.replace("_"," ")}</span></div>
            <strong>{job.recipient_name}</strong><p>{job.delivery_address}</p>
            <div className="operation-meta"><span>Fee {money(job.delivery_fee_paise)}</span><span>Collect {money(job.cash_to_collect_paise)}</span></div>
            <div className="operation-meta"><small>{dateLabel(job.created_at)}</small>{(job.status==="queued" ? ["owner","admin"].includes(business?.role ?? "") : ["assigned","picked_up","in_transit"].includes(job.status))&&<button className="text-action" disabled={busy} onClick={()=>void advanceDelivery(job)}>{job.status==="queued"?"Assign to me":job.status==="assigned"?"Mark picked up":job.status==="picked_up"?"Mark in transit":"Mark delivered"} <ArrowUpRight size={13}/></button>}</div>
          </article>)}</div> : <div className="empty-inline">No delivery jobs yet. Create the first one.</div>}
      </section>
    </div>
  </>;
}

export function CommunicationsPage() {
  const { business, configured } = useBusiness();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [consent, setConsent] = useState("opted_in");
  const [source, setSource] = useState("in_person_recorded");
  const [purpose, setPurpose] = useState("delivery_update");
  const [template, setTemplate] = useState("delivery-status-v1");
  const [message, setMessage] = useState("");
  const [confirmedConsent, setConfirmedConsent] = useState(false);
  const [confirmedQueue, setConfirmedQueue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notificationKey, setNotificationKey] = useState(() => crypto.randomUUID());

  async function load() {
    if (!supabase || !business) return;
    const { data, error: loadError } = await supabase.from("customers")
      .select("id,display_name").eq("business_id", business.id).order("display_name");
    if (loadError) { setError("Customer list could not be loaded."); return; }
    setCustomers((data ?? []) as CustomerOption[]);
    if (!customerId && data?.[0]) setCustomerId(data[0].id);
  }
  useEffect(() => { if (configured) void load(); }, [business?.id, configured]);

  async function saveConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !business || !confirmedConsent) return;
    setBusy(true); setError(""); setSuccess("");
    const { error: invokeError } = await supabase.functions.invoke("customer-communication", {
      body: { action: "set_consent", business_id: business.id, customer_id: customerId,
        channel, consent_status: consent, consent_source: source, confirmed: true },
    });
    if (invokeError) setError("Consent preference could not be saved. Check the customer and evidence source.");
    else setSuccess(`${channel.toUpperCase()} consent updated for the selected customer.`);
    setConfirmedConsent(false); setBusy(false);
  }

  async function queueMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !business || !confirmedQueue) return;
    setBusy(true); setError(""); setSuccess("");
    const { error: invokeError } = await supabase.functions.invoke("customer-communication", {
      body: { action: "queue", business_id: business.id, customer_id: customerId,
        channel, purpose, template_key: template, payload: { message },
        idempotency_key: notificationKey, confirmed: true },
    });
    if (invokeError) setError("Message was not queued. Confirm the customer has opted in to this channel.");
    else { setSuccess("Notification queued. It has not been sent to the customer."); setNotificationKey(crypto.randomUUID()); }
    setConfirmedQueue(false); setBusy(false);
  }

  return <>
    <PageHeader icon={MessageCircle} eyebrow="CUSTOMER RELATIONSHIPS" title="Communications" description="Record channel consent and prepare customer updates without sending them automatically."/>
    {!configured && <div className="demo-notice"><span className="live-dot"/> Preview mode · Connect the dedicated backend to manage consent and queues.</div>}
    <section className="workspace-panel communication-intro"><h2>Consent comes first</h2><p>Unknown or opted-out customers cannot be added to the notification queue. Queueing creates an internal job only; no WhatsApp, SMS or email is sent by this screen.</p></section>
    <div className="operations-grid">
      <section className="workspace-panel">
        <div className="workspace-panel-heading"><div><h2>Communication consent</h2><p>Store the customer's choice for one channel.</p></div></div>
        <form className="operations-form single-column" onSubmit={saveConsent}>
          <label>Customer<select required value={customerId} onChange={e=>{setCustomerId(e.target.value);setNotificationKey(crypto.randomUUID());}}><option value="">Choose customer…</option>{customers.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>
          <label>Channel<select value={channel} onChange={e=>{setChannel(e.target.value);setNotificationKey(crypto.randomUUID());}}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option></select></label>
          <label>Customer preference<select value={consent} onChange={e=>setConsent(e.target.value)}><option value="opted_in">Opted in</option><option value="opted_out">Opted out</option></select></label>
          <label>Consent source<input required maxLength={80} value={source} onChange={e=>setSource(e.target.value)} placeholder="In person, paper form, etc."/></label>
          <label className="operations-confirm"><input type="checkbox" checked={confirmedConsent} onChange={e=>setConfirmedConsent(e.target.checked)}/> I verified and recorded the customer's choice.</label>
          <button className="auth-submit" disabled={!configured||busy||!customerId||!confirmedConsent}>Save consent preference</button>
        </form>
      </section>
      <section className="workspace-panel">
        <div className="workspace-panel-heading"><div><h2>Queue a notification</h2><p>Requires explicit channel opt-in.</p></div><span className="count-pill">Queue only</span></div>
        <form className="operations-form single-column" onSubmit={queueMessage}>
          <label>Customer<select required value={customerId} onChange={e=>{setCustomerId(e.target.value);setNotificationKey(crypto.randomUUID());}}><option value="">Choose customer…</option>{customers.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>
          <label>Channel<select value={channel} onChange={e=>{setChannel(e.target.value);setNotificationKey(crypto.randomUUID());}}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option></select></label>
          <label>Purpose<select value={purpose} onChange={e=>{setPurpose(e.target.value);setNotificationKey(crypto.randomUUID());}}><option value="delivery_update">Delivery update</option><option value="receipt">Receipt</option><option value="payment_reminder">Payment reminder</option><option value="general">General</option></select></label>
          <label>Template key<input required maxLength={80} value={template} onChange={e=>{setTemplate(e.target.value);setNotificationKey(crypto.randomUUID());}}/></label>
          <label>Message<textarea required maxLength={2000} value={message} onChange={e=>{setMessage(e.target.value);setNotificationKey(crypto.randomUUID());}} placeholder="Write the notification text…"/></label>
          <label className="operations-confirm"><input type="checkbox" checked={confirmedQueue} onChange={e=>setConfirmedQueue(e.target.checked)}/> I confirm this message should be queued for the opted-in customer.</label>
          <button className="auth-submit" disabled={!configured||busy||!customerId||!message.trim()||!confirmedQueue}>Queue notification</button>
        </form>
      </section>
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {success && <p className="auth-success" role="status">{success}</p>}
  </>;
}


type DailySummary = {
  business_date: string;
  credit_sales_count: number;
  credit_sales_paise: number;
  payments_count: number;
  payments_received_paise: number;
};

export function ReportsPage() {
  const { business, configured } = useBusiness();
  const [rows, setRows] = useState<DailySummary[]>([]);
  const [error, setError] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  useEffect(() => {
    if (!supabase || !business) return;
    let active = true;
    void (async () => {
      const { data, error: queryError } = await supabase.from("business_daily_summary")
        .select("business_date,credit_sales_count,credit_sales_paise,payments_count,payments_received_paise")
        .eq("business_id", business.id).order("business_date", { ascending: false }).limit(30);
      if (!active) return;
      if (queryError) { setError("Daily business summary could not be loaded."); return; }
      setRows((data ?? []) as DailySummary[]);
    })();
    return () => { active = false; };
  }, [business?.id]);

  const todayRow = rows.find(row => row.business_date === today);
  const sales = rows.reduce((sum, row) => sum + Number(row.credit_sales_paise), 0);
  const receipts = rows.reduce((sum, row) => sum + Number(row.payments_received_paise), 0);
  const salesCount = rows.reduce((sum, row) => sum + Number(row.credit_sales_count), 0);

  return <>
    <PageHeader icon={BarChart3} eyebrow="BUSINESS INTELLIGENCE" title="Reports" description="Review daily credit sales and customer receipts, grouped by India Standard Time."/>
    {!configured && <div className="demo-notice"><span className="live-dot"/> Preview mode · Daily totals will appear when the backend is connected.</div>}
    <div className="workspace-metrics">
      <article className="workspace-metric"><small>Today's credit sales</small><strong>{money(configured ? Number(todayRow?.credit_sales_paise ?? 0) : 1250000)}</strong><span>{configured ? `${todayRow?.credit_sales_count ?? 0} transactions` : "Sample shop data"}</span></article>
      <article className="workspace-metric"><small>Today's receipts</small><strong>{money(configured ? Number(todayRow?.payments_received_paise ?? 0) : 540000)}</strong><span>{configured ? `${todayRow?.payments_count ?? 0} receipts` : "Sample shop data"}</span></article>
      <article className="workspace-metric"><small>30-day credit sales</small><strong>{money(configured ? sales : 8425000)}</strong><span>{configured ? `${salesCount} transactions` : "Sample shop data"}</span></article>
      <article className="workspace-metric"><small>30-day receipts</small><strong>{money(configured ? receipts : 4250000)}</strong><span>Ledger-based totals</span></article>
    </div>
    <section className="workspace-panel">
      <div className="workspace-panel-heading"><div><h2>Daily activity</h2><p>Last 30 business dates · Asia/Kolkata</p></div><span className="count-pill">{configured ? rows.length : 30} days</span></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!configured ? <div className="empty-inline">Connect a backend to view real daily totals.</div> :
        rows.length ? <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Business date</th><th>Credit sales</th><th>Sales total</th><th>Receipts</th><th>Received</th></tr></thead><tbody>{rows.map(row=><tr key={row.business_date}><td>{new Date(row.business_date+"T00:00:00+05:30").toLocaleDateString("en-IN",{dateStyle:"medium"})}</td><td>{row.credit_sales_count}</td><td>{money(Number(row.credit_sales_paise))}</td><td>{row.payments_count}</td><td>{money(Number(row.payments_received_paise))}</td></tr>)}</tbody></table></div> :
        <div className="empty-inline">No daily activity has been recorded yet.</div>}
    </section>
    <p className="detail-footnote"><Activity size={13}/> Totals are grouped by business date in India Standard Time and read from the security-invoker summary view.</p>
  </>;
}
