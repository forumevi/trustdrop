import { useState, useEffect } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount, useReadContract } from 'wagmi';
import { Shield, Plus, X, ExternalLink, Lock } from 'lucide-react';
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

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)', backgroundAttachment: 'fixed' }}>

      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b px-5 py-3.5"
        style={{
          background: 'rgba(13,27,47,0.85)',
          backdropFilter: 'blur(20px)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(172,198,233,0.12)', border: '1px solid rgba(172,198,233,0.2)' }}
            >
              <Lock size={15} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1
                className="display text-base font-bold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
              >
                TrustDrop
              </h1>
              <p className="text-xs" style={{ color: 'var(--subtle)', lineHeight: 1.2 }}>
                USDC inheritance vault · Arc mainnet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isDeployed && (
              <a
                href={`https://explorer.arc.io/address/${TRUSTDROP_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-1 text-xs transition-colors"
                style={{ color: 'var(--subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--subtle)')}
              >
                <ExternalLink size={11} />
                Contract
              </a>
            )}
            <ConnectKitButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-12">

        {/* Hero */}
        <div className="mb-14 max-w-2xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{
              background: 'rgba(172,198,233,0.10)',
              border: '1px solid rgba(172,198,233,0.20)',
              color: 'var(--accent)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live on Arc mainnet
          </div>
          <h2
            className="display text-4xl md:text-5xl font-bold mb-4 text-balance"
            style={{ color: 'var(--ink)', letterSpacing: '-0.035em', lineHeight: 1.1 }}
          >
            Your USDC,
            <br />
            <span style={{ color: 'var(--accent)' }}>secured by proof of life.</span>
          </h2>
          <p
            className="text-base leading-relaxed text-pretty max-w-xl"
            style={{ color: 'var(--muted)' }}
          >
            Lock USDC in a vault. Check in periodically with a post-quantum SLH-DSA signature.
            If you stop checking in, your beneficiaries claim the funds automatically.
            A stolen wallet cannot fake a check-in — it requires the offline key card.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-14">
          {[
            {
              step: '01',
              title: 'Create a vault',
              desc: 'Lock USDC, set your check-in interval, add beneficiaries and their percentage shares.',
            },
            {
              step: '02',
              title: 'Check in regularly',
              desc: 'Sign a message with your offline SLH-DSA key card. No key card, no valid check-in.',
            },
            {
              step: '03',
              title: 'Miss a check-in?',
              desc: 'After the grace window expires, any beneficiary can claim. Or withdraw anytime while active.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl p-6"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <span
                className="mono text-xs font-medium tracking-widest"
                style={{ color: 'var(--accent)', opacity: 0.7 }}
              >
                {item.step}
              </span>
              <h3
                className="font-semibold mt-2.5 mb-2 text-sm"
                style={{ color: 'var(--ink-2)' }}
              >
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--subtle)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Not deployed */}
        {!isDeployed && (
          <div
            className="rounded-2xl p-5 mb-8 text-sm"
            style={{
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.20)',
              color: '#fbbf24cc',
            }}
          >
            Contract not yet deployed. Set{' '}
            <code className="mono text-yellow-300">VITE_TRUSTDROP_ADDRESS</code> in .env.
          </div>
        )}

        {/* Vault section */}
        {isDeployed && (
          <>
            {/* Section header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3
                  className="font-semibold text-sm uppercase tracking-widest"
                  style={{ color: 'var(--subtle)' }}
                >
                  All vaults
                </h3>
                {vaultCount > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)', opacity: 0.6 }}>
                    {vaultCount} vault{vaultCount !== 1 ? 's' : ''} on Arc mainnet
                  </p>
                )}
              </div>
              {isConnected && (
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: showCreate ? 'var(--surface)' : 'var(--accent)',
                    color: showCreate ? 'var(--muted)' : '#0d1b2f',
                    border: showCreate ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!showCreate) (e.currentTarget).style.background = 'var(--accent-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!showCreate) (e.currentTarget).style.background = 'var(--accent)';
                  }}
                >
                  {showCreate ? <X size={14} /> : <Plus size={14} />}
                  {showCreate ? 'Cancel' : 'New vault'}
                </button>
              )}
            </div>

            {/* Create form */}
            {showCreate && isConnected && (
              <div
                className="rounded-2xl p-6 mb-6"
                style={{
                  background: 'var(--surface-strong)',
                  border: '1px solid var(--border-strong)',
                }}
              >
                <h4
                  className="display font-semibold mb-5 text-base"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
                >
                  Create vault
                </h4>
                <CreateVaultForm
                  onCreated={() => {
                    setShowCreate(false);
                    void refetchCount();
                  }}
                />
              </div>
            )}

            {/* Vault grid */}
            {vaultCount === 0 ? (
              <div
                className="text-center py-20 rounded-2xl"
                style={{ border: '1px dashed var(--border)' }}
              >
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <Shield size={22} style={{ color: 'var(--subtle)', opacity: 0.5 }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                  No vaults yet
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
                  {isConnected ? 'Create the first vault.' : 'Connect your wallet to create a vault.'}
                </p>
                {!isConnected && (
                  <div className="mt-5">
                    <ConnectKitButton />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vaultIds.map((id) => (
                  <VaultCard key={id.toString()} vaultId={id} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        className="border-t px-5 py-6 mt-12"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
          style={{ color: 'var(--subtle)', opacity: 0.6 }}
        >
          <p>TrustDrop · built on Arc mainnet with Arc Studio · unaudited prototype</p>
          <p>
            Arc uses USDC as gas. Transactions are irreversible.{' '}
            <a
              href="https://docs.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: 'var(--accent)' }}
            >
              docs.arc.io
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
