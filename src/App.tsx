import { useEffect, useState } from "react";
import VoiceWorkspace from "./voice/VoiceWorkspace";
import WorkspacePage from "./features/WorkspacePage";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { BusinessProvider, useBusiness } from "./business/BusinessContext";
import BusinessOnboarding from "./business/BusinessOnboarding";
import {
  Activity, ArrowUpRight, Bell, BookOpen, Boxes, ChevronDown, CircleHelp,
  Command, CreditCard, LayoutDashboard, Mic, Package, Plus, Search,
  Settings2, ShoppingBag, Sparkles, Users, Wallet, Zap, Truck, MessageCircle,
} from "lucide-react";

const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Khata ledger", icon: BookOpen },
  { label: "Customers", icon: Users },
  { label: "Inventory", icon: Boxes },
  { label: "Sales & billing", icon: ShoppingBag },
  { label: "Payments", icon: Wallet },
  { label: "Deliveries", icon: Truck },
  { label: "Communications", icon: MessageCircle },
];

const activity = [
  { name: "Ananya Stores", detail: "Today, 11:42 AM · 2 items", amount: "+₹1,250", type: "sale" },
  { name: "Rahul Das", detail: "Today, 10:18 AM · Credit added", amount: "₹450", type: "credit" },
  { name: "Maa Grocery", detail: "Today, 9:56 AM · Payment received", amount: "+₹800", type: "payment" },
];

function BusinessApp() {
  const { configured, user, signOut } = useAuth();
  const { business, loading: businessLoading, error: businessError, refresh: refreshBusiness } = useBusiness();
  if (configured && businessLoading) return <div className="auth-loading" role="status">Loading your business workspace…</div>;
  if (configured && !business && businessError) return <main className="auth-screen"><section className="auth-card"><div className="eyebrow">WORKSPACE ACCESS</div><h1>We couldn't load your shop.</h1><p className="auth-intro">{businessError}</p><button className="auth-submit" onClick={() => void refreshBusiness()}>Retry workspace access</button></section></main>;
  if (configured && !business) return <BusinessOnboarding/>;
  const [active, setActive] = useState("Overview");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Boli-Khata home">
          <span className="brand-mark"><Command size={21} /></span>
          <span><strong>boli<span>-</span>khata</strong><small>BUSINESS, SIMPLIFIED</small></span>
        </a>
        <div className="workspace-switch"><div className="store-avatar">S</div><div className="workspace-copy"><strong>{business?.name ?? "Sample General Store"}</strong><small>{business ? business.role+" workspace" : "Preview workspace"}</small></div><ChevronDown size={16} /></div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)}><Icon size={18} /><span>{label}</span>{label === "Khata ledger" && <span className="nav-count">8</span>}</button>)}
        </nav>
        <p className="nav-label tools-label">PREFERENCES</p>
        <button className="nav-item" onClick={() => setActive("Settings")}><Settings2 size={18} /><span>Settings</span></button>
        <button className="nav-item" onClick={() => setActive("Help & support")}><CircleHelp size={18} /><span>Help & support</span></button>
        <div className="sidebar-bottom">
          <div className="plan-card"><span className="plan-icon"><Zap size={16} /></span><strong>Your shop, at a glance</strong><p>Your daily business overview lives here. More tools are coming soon.</p><span className="plan-link">Explore the roadmap <ArrowUpRight size={13} /></span></div>
          <div className="profile-row"><div className="profile-avatar">{(user?.email ?? "PS").slice(0,2).toUpperCase()}</div><div><strong>{user?.email?.split("@")[0] ?? "Preview owner"}</strong><small>{configured ? "Signed-in account" : "Demo workspace"}</small></div><button aria-label="Sign out" title="Sign out" onClick={() => { void signOut().catch(() => undefined); }}><ChevronDown size={16} /></button></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div><div className="top-actions"><span className={!configured ? "connection-chip preview" : online ? "connection-chip online" : "connection-chip offline"} role="status"><i/>{!configured ? "Preview mode" : online ? "Secure session" : "Offline · shell only"}</span><div className="search-box"><Search size={16} /><input aria-label="Search" placeholder="Search anything..." /><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">{(user?.email ?? "PS").slice(0,2).toUpperCase()}</div></div></header>
        <div className="page-content">{active === "Overview" ? <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> YOUR BUSINESS AT A GLANCE</div><h1>Good morning, Priya <span>✳</span></h1><p>Here's what's happening with your store today.</p></div><button className="date-button">Today, 8 November <ChevronDown size={15} /></button></section>
          <section className="voice-banner"><div className="voice-orb"><Mic size={23} /></div><div className="voice-copy"><span className="voice-kicker">MEET YOUR BUSINESS ASSISTANT</span><h2>Your shop. Your language. Your pace.</h2><p>Speak naturally or type what you need. Boli-Khata is being built to make everyday shop work simpler.</p></div><button className="voice-button" onClick={() => setVoiceOpen(!voiceOpen)}><Mic size={17} /> Try voice workspace</button><div className="banner-decoration" /></section>
          {voiceOpen && <VoiceWorkspace onContinue={() => setActive("Sales & billing")} />}
          <section className="section-heading"><div><h2>Today's overview</h2><p>A quick look at your shop's activity.</p></div><button className="subtle-button">View reports <ArrowUpRight size={15} /></button></section>
          <section className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span>Sales today</span><span className="stat-icon green"><ShoppingBag size={17} /></span></div><strong>₹12,840</strong><div className="stat-foot positive"><ArrowUpRight size={14} /> 12.8% <span>vs. yesterday</span></div><div className="sparkline green-line">{Array.from({length:12},(_,i)=><i key={i}/>)}</div></article>
            <article className="stat-card"><div className="stat-top"><span>Udhar outstanding</span><span className="stat-icon amber"><CreditCard size={17} /></span></div><strong>₹8,450</strong><div className="stat-foot neutral">Across <b>14 customers</b></div><div className="mini-progress"><span /></div></article>
            <article className="stat-card"><div className="stat-top"><span>Items in stock</span><span className="stat-icon blue"><Package size={17} /></span></div><strong>248 <small>items</small></strong><div className="stat-foot warning"><Activity size={14} /> 3 items <span>running low</span></div><div className="mini-progress blue-progress"><span /></div></article>
            <article className="stat-card"><div className="stat-top"><span>Transactions</span><span className="stat-icon violet"><Activity size={17} /></span></div><strong>36</strong><div className="stat-foot positive"><ArrowUpRight size={14} /> 8.2% <span>vs. yesterday</span></div><div className="sparkline violet-line">{Array.from({length:12},(_,i)=><i key={i}/>)}</div></article>
          </section>
          <section className="content-grid">
            <article className="panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest shop transactions.</p></div><button className="text-button">See all <ArrowUpRight size={14}/></button></div><div className="transaction-list">{activity.map(item=><div className="transaction" key={item.name}><div className={"transaction-icon "+item.type}>{item.type==="sale"?<ShoppingBag size={17}/>:item.type==="credit"?<CreditCard size={17}/>:<Wallet size={17}/>}</div><div className="transaction-info"><strong>{item.name}</strong><small>{item.detail}</small></div><strong className={item.type==="credit"?"amount debit":"amount"}>{item.amount}</strong></div>)}</div><div className="panel-footer">Demo content · Sample data only</div></article>
            <article className="panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, one tap away.</p></div><span className="quick-spark"><Sparkles size={17}/></span></div><div className="quick-actions"><button onClick={()=>setActive("Customers")}><span className="quick-icon lilac"><Users size={18}/></span><span><strong>Add customer</strong><small>Create a customer profile</small></span><Plus size={16}/></button><button onClick={()=>setActive("Khata ledger")}><span className="quick-icon peach"><BookOpen size={18}/></span><span><strong>Record udhar</strong><small>Log a credit entry</small></span><Plus size={16}/></button><button onClick={()=>setActive("Inventory")}><span className="quick-icon mint"><Package size={18}/></span><span><strong>Add a product</strong><small>Update your catalogue</small></span><Plus size={16}/></button></div></article>
          </section>
          <footer className="page-footer"><span>© 2026 Boli-Khata</span><span><i className="footer-dot"/> Foundation preview · Sample data only</span><span>Made for everyday business <b className="footer-heart">♥</b></span></footer>
        </> : <WorkspacePage active={active}/>}</div>
      </main>
    </div>
  );
}


export default function App() {
  return <AuthProvider><BusinessProvider><BusinessApp /></BusinessProvider></AuthProvider>;
}
