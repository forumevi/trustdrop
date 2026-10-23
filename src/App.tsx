import { useState, useEffect } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount, useReadContract } from 'wagmi';
import { Shield, Plus, ExternalLink, ArrowRight, Lock, Clock, Users } from 'lucide-react';
import { VaultCard } from './components/VaultCard';
import { CreateVaultForm } from './components/CreateVaultForm';
import { TRUSTDROP_ABI, TRUSTDROP_ADDRESS } from './lib/trustdrop';

export default function App() {
  const { isConnected } = useAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const { data: nextVaultId, refetch: refetchCount } = useReadContract({
    address: TRUSTDROP_ADDRESS,
    abi: TRUSTDROP_ABI,
    functionName: 'nextVaultId',
  });

  const vaultCount = nextVaultId ? Number(nextVaultId) - 1 : 0;
  const vaultIds = Array.from({ length: vaultCount }, (_, i) => BigInt(i + 1));
  const isDeployed = TRUSTDROP_ADDRESS.length > 0;
  const hasVaults = vaultCount > 0 || showCreate;

  return (
    <div className="min-h-dvh" style={{ background: '#0a0b0e', color: '#f0f4fa', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ─── NAV ─────────────────────────────────────────────── */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div style={{ background: 'rgba(172,198,233,0.12)', border: '1px solid rgba(172,198,233,0.2)' }}
              className="w-8 h-8 rounded-lg flex items-center justify-center">
              <Shield size={15} style={{ color: '#acc6e9' }} />
            </div>
            <span className="font-semibold text-sm tracking-tight display" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              TrustDrop
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isDeployed && (
              <a
                href={`https://explorer.arc.io/address/${TRUSTDROP_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
              >
                <ExternalLink size={11} />
                Arc mainnet
              </a>
            )}
            <ConnectKitButton />
          </div>
        </div>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────── */}
      {!hasVaults && (
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* LEFT: copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 text-xs font-medium"
              style={{ background: 'rgba(110,231,154,0.08)', border: '1px solid rgba(110,231,154,0.2)', color: '#6ee79a' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live on Arc mainnet · Chain 5042
            </div>

            <h1
              className="text-5xl lg:text-6xl font-bold leading-[1.05] mb-6 text-balance"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
            >
              Your USDC,<br />
              <span style={{ color: '#acc6e9' }}>alive as long<br />as you are.</span>
            </h1>

            <p className="text-lg leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '42ch' }}>
              Lock USDC in a vault. Check in monthly with a post-quantum signature.
              Miss a check-in — your beneficiaries claim everything. No middleman. No lawyer. No trust.
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              {isConnected ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: '#acc6e9', color: '#0a0b0e' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#cbdbf2')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#acc6e9')}
                >
                  Create a vault
                  <ArrowRight size={16} />
                </button>
              ) : (
                <ConnectKitButton />
              )}
              <a
                href="https://docs.arc.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                How Arc works →
              </a>
            </div>
          </div>

          {/* RIGHT: feature cards */}
          <div className="grid grid-cols-1 gap-3">
            {[
              {
                icon: Lock,
                title: 'Lock USDC',
                desc: 'Deposit any amount. Set a check-in interval — 7 days, 30 days, 1 year. Choose beneficiaries and their percentage share.',
              },
              {
                icon: Clock,
                title: 'Prove you\'re alive',
                desc: 'Sign a message with your offline post-quantum key card. Your EVM wallet alone cannot fake a check-in — the key card must be present.',
              },
              {
                icon: Users,
                title: 'Miss a check-in?',
                desc: 'After the grace window, any beneficiary can trigger a claim. USDC is distributed instantly on Arc. No court. No delay.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-4 p-5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(172,198,233,0.1)', border: '1px solid rgba(172,198,233,0.15)' }}>
                  <Icon size={16} style={{ color: '#acc6e9' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── VAULT AREA ─────────────────────────────────────── */}
      {isDeployed && (
        <section className="max-w-6xl mx-auto px-6 pb-20">

          {hasVaults && (
            <div className="flex items-center justify-between mb-8 pt-10">
              <div>
                <h2 className="font-bold text-xl display" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {showCreate && vaultCount === 0 ? 'Create a vault' : `Vaults (${vaultCount})`}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Arc mainnet · USDC
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isConnected && !showCreate && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: '#acc6e9', color: '#0a0b0e' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#cbdbf2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#acc6e9')}
                  >
                    <Plus size={14} />
                    New vault
                  </button>
                )}
                {showCreate && (
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2.5 rounded-xl text-sm transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Create form */}
          {showCreate && isConnected && (
            <div className="rounded-2xl p-7 mb-8"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <CreateVaultForm
                onCreated={() => {
                  setShowCreate(false);
                  void refetchCount();
                }}
              />
            </div>
          )}

          {/* Connect prompt inside vault area */}
          {!isConnected && hasVaults && (
            <div className="text-center py-12">
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Connect your wallet to create a vault
              </p>
              <ConnectKitButton />
            </div>
          )}

          {/* Vault grid */}
          {vaultCount > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaultIds.map((id) => (
                <VaultCard key={id.toString()} vaultId={id} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── FOOTER ─────────────────────────────────────────── */}
      <footer className="px-6 py-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ color: 'rgba(255,255,255,0.2)' }}>
          <p>TrustDrop · Built on Arc mainnet with Arc Studio · Unaudited prototype</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/forumevi/trustdrop" target="_blank" rel="noopener noreferrer"
              className="transition-colors hover:text-white/40">GitHub</a>
            <a href={`https://explorer.arc.io/address/${TRUSTDROP_ADDRESS}`} target="_blank" rel="noopener noreferrer"
              className="transition-colors hover:text-white/40">Explorer</a>
            <a href="https://docs.arc.io" target="_blank" rel="noopener noreferrer"
              className="transition-colors hover:text-white/40">Docs</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
