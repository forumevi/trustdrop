import { useState, useEffect, useRef, useCallback } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract } from 'wagmi'
import { ExternalLink, Shield, Clock, Users, Github, ArrowRight, AlertTriangle } from 'lucide-react'
import { VaultCard } from './components/VaultCard'
import { CreateVaultForm } from './components/CreateVaultForm'
import { TRUSTDROP_ABI, TRUSTDROP_ADDRESS } from './lib/trustdrop'

/* ─────────────────────────────────────────
   Typing headline
───────────────────────────────────────── */

function TypingHeadline() {
  const [text, setText] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    const full = 'alive as long as you are.'
    let i = 0
    const tick = () => {
      if (i <= full.length) {
        setText(full.slice(0, i))
        i++
        setTimeout(tick, i <= full.length ? 55 : 0)
      } else {
        setShowCursor(false)
      }
    }
    const start = setTimeout(tick, 400)
    return () => clearTimeout(start)
  }, [])

  return (
    <h1 className="display fade-up delay-1" style={{
      fontSize: 'clamp(2.8rem, 6.5vw, 5rem)',
      fontWeight: 700,
      letterSpacing: '-0.035em',
      lineHeight: 1.08,
      marginBottom: '1.8rem',
    }}>
      Your USDC,{' '}
      <br />
      <span style={{ color: 'var(--accent)' }}>{text}</span>
      {showCursor && <span className="cursor" />}
    </h1>
  )
}

/* ─────────────────────────────────────────
   Scroll-reveal hook
───────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect() }
    }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

/* ─────────────────────────────────────────
   Animated counter
───────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      let s = 0
      const step = to / 45
      const id = setInterval(() => {
        s = Math.min(s + step, to)
        setVal(Math.round(s))
        if (s >= to) clearInterval(id)
      }, 22)
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref} className="tabular-nums">{val}{suffix}</span>
}

/* ─────────────────────────────────────────
   Section wrapper
───────────────────────────────────────── */
function Section({ children, id, style }: { children: React.ReactNode; id?: string; style?: React.CSSProperties }) {
  const ref = useReveal()
  return (
    <section
      id={id}
      ref={ref}
      className="reveal"
      style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', ...style }}
    >
      {children}
    </section>
  )
}

/* ─────────────────────────────────────────
   Main App
───────────────────────────────────────── */
export default function App() {
  const { isConnected } = useAccount()
  const [showCreate, setShowCreate] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  void tick

  const { data: nextVaultId, refetch: refetchCount } = useReadContract({
    address: TRUSTDROP_ADDRESS,
    abi: TRUSTDROP_ABI,
    functionName: 'nextVaultId',
  })

  const scrollToApp = useCallback(() => {
    document.getElementById('app')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const vaultCount = nextVaultId ? Number(nextVaultId) - 1 : 0
  const vaultIds   = Array.from({ length: vaultCount }, (_, i) => BigInt(i + 1))

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', position: 'relative' }}>

      {/* ── Ambient background ── */}
      <div className="orb" style={{ width: 700, height: 700, background: 'radial-gradient(circle, rgba(60,120,220,0.14) 0%, transparent 65%)', top: '-180px', left: '-180px', animationDuration: '18s' }} />
      <div className="orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(100,170,240,0.10) 0%, transparent 65%)', top: '25%', right: '-120px', animationDuration: '12s', animationDelay: '-5s' }} />
      <div className="orb" style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(60,200,120,0.06) 0%, transparent 65%)', bottom: '5%', left: '15%', animationDuration: '20s', animationDelay: '-10s' }} />

      {/* ══════════════════════════════
          NAV
      ══════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(24px)',
        background: 'rgba(8,12,18,0.85)',
        padding: '0 2rem',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src="/trustdrop-logo.svg"
              alt="TrustDrop"
              style={{ width: 52, height: 52, flexShrink: 0 }}
            />
            <div>
              <div className="display" style={{ fontWeight: 800, fontSize: '1.7rem', letterSpacing: '-0.04em', lineHeight: 1 }}>TrustDrop</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 3 }}>USDC Inheritance Vault</div>
            </div>
          </div>

          {/* Right nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a
              href={`https://explorer.arc.io/address/${TRUSTDROP_ADDRESS}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', flexShrink: 0 }} />
              Arc mainnet
              <ExternalLink size={11} />
            </a>
            <a
              href="https://github.com/forumevi/trustdrop"
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--subtle)', display: 'flex', transition: 'color 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--ink)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--subtle)')}
            >
              <Github size={18} />
            </a>
            <ConnectKitButton />
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(5rem,12vw,9rem) 1.5rem 5rem' }}>

        {/* Live badge */}
        <div className="fade-up" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(74,222,128,0.06)',
          border: '1px solid rgba(74,222,128,0.18)',
          borderRadius: 100, padding: '5px 16px',
          fontSize: '0.72rem', color: 'var(--success)',
          letterSpacing: '0.07em', textTransform: 'uppercase',
          marginBottom: '2.5rem',
        }}>
          <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          Live on Arc mainnet · Chain 5042
        </div>

        <TypingHeadline />

        <p className="fade-up delay-2" style={{
          fontSize: 'clamp(1.05rem,2vw,1.25rem)',
          color: 'rgba(240,244,250,0.48)',
          lineHeight: 1.75,
          maxWidth: '54ch',
          marginBottom: '2.8rem',
        }}>
          Lock USDC in a vault. Check in with a post-quantum SLH-DSA signature to prove you are alive.
          Miss a check-in and your beneficiaries claim everything automatically.
          No lawyers. No middlemen. No trust required.
        </p>

        <div className="fade-up delay-3" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: '5rem' }}>
          <button
            onClick={scrollToApp}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 32px',
              background: 'var(--accent)', color: '#080c12',
              borderRadius: 14, border: 'none',
              fontWeight: 700, fontSize: '0.95rem',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s, transform 0.1s',
              boxShadow: '0 0 32px rgba(132,184,232,0.25)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
          >
            Create a vault
            <ArrowRight size={16} />
          </button>
          <a
            href="#how-it-works"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 32px',
              background: 'transparent', color: 'var(--ink-2)',
              borderRadius: 14, border: '1px solid var(--border-strong)',
              fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(132,184,232,0.6)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.color = 'var(--ink-2)' }}
          >
            How it works
          </a>
        </div>

        {/* Stats strip */}
        <div className="fade-up delay-4" style={{ display: 'flex', gap: 48, flexWrap: 'wrap', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Contract',      value: <span className="mono" style={{ fontSize: '0.88rem' }}>0x9A0f…5d31</span> },
            { label: 'Foundry tests', value: <><Counter to={92} />+</> },
            { label: 'Gas / check-in', value: <><span style={{ fontSize: '1rem' }}>~</span><Counter to={85} suffix="k" /></> },
            { label: 'Chain',         value: <span style={{ color: 'var(--success)' }}>5042</span> },
            { label: 'USDC gas',      value: <span style={{ color: 'var(--accent)' }}>native</span> },
          ].map(s => (
            <div key={String(s.label)}>
              <div className="display" style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--subtle)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" style={{ maxWidth: 1100, padding: '0 1.5rem' }}><div /></div>

      {/* ══════════════════════════════
          HOW IT WORKS
      ══════════════════════════════ */}
      <Section id="how-it-works" style={{ padding: '6rem 1.5rem' }}>
        <p style={{ fontSize: '0.68rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.8rem', fontWeight: 600 }}>How it works</p>
        <h2 className="display" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '3rem', color: 'var(--ink)' }}>
          Three steps. One guarantee.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
          {[
            {
              n: '01', icon: Shield, color: 'rgba(132,184,232,0.12)', border: 'rgba(132,184,232,0.20)',
              title: 'Lock USDC',
              body: 'Deposit any amount. Set a check-in interval from 7 days to 1 year. Choose beneficiaries with their percentage shares. Funds stay in the contract.',
            },
            {
              n: '02', icon: Clock, color: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.18)',
              title: 'Prove you are alive',
              body: "Each interval, prove you are alive. Use your EVM wallet for a quick check-in, or sign with your offline SLH-DSA key for post-quantum grade proof. Arc's precompile verifies it inside the transaction.",
            },
            {
              n: '03', icon: Users, color: 'rgba(248,200,80,0.07)', border: 'rgba(248,200,80,0.16)',
              title: 'Miss a check-in',
              body: 'After the interval plus grace window passes, any beneficiary calls claim(). The contract distributes USDC proportionally. Settled on Arc in under a second.',
            },
          ].map(s => (
            <div key={s.n} style={{ background: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.4rem' }}>
                <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--subtle)', letterSpacing: '0.12em' }}>{s.n}</span>
                <s.icon size={20} style={{ color: 'var(--accent)', opacity: 0.6 }} />
              </div>
              <h3 className="display" style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>{s.title}</h3>
              <p style={{ fontSize: '0.88rem', color: 'rgba(240,244,250,0.48)', lineHeight: 1.75 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="section-divider" style={{ maxWidth: 1100, padding: '0 1.5rem' }}><div /></div>

      {/* ══════════════════════════════
          WHY ARC
      ══════════════════════════════ */}
      <Section style={{ padding: '6rem 1.5rem' }}>
        <p style={{ fontSize: '0.68rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.8rem', fontWeight: 600 }}>Why Arc</p>
        <h2 className="display" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '2.5rem', color: 'var(--ink)' }}>
          Built for this chain specifically.
        </h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                {['Property', 'Value', 'Why it matters'].map(h => (
                  <th key={h} style={{ padding: '14px 24px', textAlign: 'left', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--subtle)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Gas token',     'USDC',            'Bounty and gas are the same asset. No ETH needed.'],
                ['PQ precompile', '0x1800...0004',   'SLH-DSA verified inside the transaction. No oracle.'],
                ['Finality',      'sub-second',      'The claim lands on-chain before the page refreshes.'],
                ['Base fee',      '~20 Gwei',        'A check-in costs ~0.009 USDC.'],
                ['Chain ID',      '5042',            'Arc mainnet, not a fork or testnet.'],
              ].map(([prop, val, sig], i) => (
                <tr key={String(prop)} style={{ borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <td className="mono" style={{ padding: '16px 24px', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 500 }}>{prop}</td>
                  <td className="mono" style={{ padding: '16px 24px', color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 600 }}>{val}</td>
                  <td style={{ padding: '16px 24px', color: 'rgba(240,244,250,0.42)', fontSize: '0.88rem' }}>{sig}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="section-divider" style={{ maxWidth: 1100, padding: '0 1.5rem' }}><div /></div>

      {/* ══════════════════════════════
          LIMITATIONS
      ══════════════════════════════ */}
      <Section style={{ padding: '6rem 1.5rem' }}>
        <p style={{ fontSize: '0.68rem', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.8rem', fontWeight: 600 }}>Limitations</p>
        <h2 className="display" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '2.5rem', color: 'var(--ink)' }}>
          Know before you deposit.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {[
            { title: 'Unaudited',            body: '67 Foundry tests are not an audit. Do not deposit more than you can lose.' },
            { title: 'Key loss is permanent', body: 'Lose your SLH-DSA key and the vault is frozen forever. No recovery, no escape hatch.' },
            { title: 'USDC denylist',         body: "Circle's denylist still applies. This does not protect against Circle blocking your address." },
            { title: 'Sig size 7,856 bytes',  body: 'Signing takes seconds, not milliseconds. Factor this into your UX.' },
          ].map(l => (
            <div key={l.title} style={{
              background: 'rgba(248,113,113,0.04)',
              border: '1px solid rgba(248,113,113,0.14)',
              borderRadius: 16, padding: '1.4rem 1.6rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={14} style={{ color: 'rgba(248,113,113,0.80)', flexShrink: 0 }} />
                <p className="display" style={{ fontSize: '0.92rem', fontWeight: 700, color: 'rgba(248,113,113,0.90)' }}>{l.title}</p>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'rgba(240,244,250,0.42)', lineHeight: 1.65 }}>{l.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="section-divider" style={{ maxWidth: 1100, padding: '0 1.5rem' }}><div /></div>

      {/* ══════════════════════════════
          APP (Vaults)
      ══════════════════════════════ */}
      <Section id="app" style={{ padding: '6rem 1.5rem 8rem' }}>
        <p style={{ fontSize: '0.68rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.8rem', fontWeight: 600 }}>Vaults</p>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: '2.5rem' }}>
          <h2 className="display" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            {showCreate ? 'Create a vault' : `All vaults (${vaultCount})`}
          </h2>
          {isConnected && (
            <button
              onClick={() => setShowCreate(v => !v)}
              style={{
                padding: '10px 24px',
                background: showCreate ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
                color: showCreate ? 'var(--ink-2)' : '#080c12',
                border: `1px solid ${showCreate ? 'var(--border-strong)' : 'transparent'}`,
                borderRadius: 12, fontWeight: 700, fontSize: '0.88rem',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!showCreate) (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { if (!showCreate) (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
            >
              {showCreate ? 'Cancel' : '+ New vault'}
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && isConnected && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(1.5rem,4vw,2.5rem)', marginBottom: '2.5rem' }}>
            <CreateVaultForm onCreated={() => { setShowCreate(false); void refetchCount() }} />
          </div>
        )}

        {/* Not connected */}
        {!isConnected && (
          <div style={{ textAlign: 'center', padding: '4rem 0', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(132,184,232,0.08)', border: '1px solid rgba(132,184,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem' }}>
              <Shield size={26} style={{ color: 'var(--accent)', opacity: 0.5 }} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Connect your wallet to create or view vaults.</p>
            <p style={{ color: 'var(--subtle)', fontSize: '0.78rem' }}>Use the button in the top right corner.</p>
          </div>
        )}

        {/* Empty state */}
        {isConnected && !showCreate && vaultCount === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 0', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(132,184,232,0.08)', border: '1px solid rgba(132,184,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem' }}>
              <Shield size={26} style={{ color: 'var(--accent)', opacity: 0.4 }} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>No vaults yet. Be the first.</p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '10px 28px', background: 'var(--accent)', color: '#080c12',
                border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.88rem',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Create first vault
            </button>
          </div>
        )}

        {/* Vault grid */}
        {isConnected && !showCreate && vaultCount > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
            {vaultIds.map(id => <VaultCard key={id.toString()} vaultId={id} />)}
          </div>
        )}
      </Section>

      {/* ══════════════════════════════
          FOOTER
      ══════════════════════════════ */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '2.5rem 2rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, fontSize: '0.78rem', color: 'var(--subtle)' }}>
          <div>
            <span className="display" style={{ fontWeight: 700, color: 'var(--muted)', fontSize: '0.88rem' }}>TrustDrop</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <span>Unaudited prototype. Built with Arc Studio.</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { label: 'Explorer', href: `https://explorer.arc.io/address/${TRUSTDROP_ADDRESS}` },
              { label: 'GitHub', href: 'https://github.com/forumevi/trustdrop' },
              { label: 'docs.arc.io', href: 'https://docs.arc.io' },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--subtle)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--ink)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--subtle)')}
              >{l.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
