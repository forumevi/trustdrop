import { useState, useEffect } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount, useReadContract } from 'wagmi';
import { Shield, Plus, X, ExternalLink } from 'lucide-react';
import { VaultCard } from './components/VaultCard';
import { CreateVaultForm } from './components/CreateVaultForm';
import { TRUSTDROP_ABI, TRUSTDROP_ADDRESS } from './lib/trustdrop';

export default function App() {
  const { isConnected } = useAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [tick, setTick] = useState(0);

  // Poll countdown every second
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick; // used to re-render countdown

  const { data: nextVaultId, refetch: refetchCount } = useReadContract({
    address: TRUSTDROP_ADDRESS,
    abi: TRUSTDROP_ABI,
    functionName: 'nextVaultId',
  });

  const vaultCount = nextVaultId ? Number(nextVaultId) - 1 : 0;
  const vaultIds = Array.from({ length: vaultCount }, (_, i) => BigInt(i + 1));

  const isDeployed = TRUSTDROP_ADDRESS.length > 0;

  return (
    <div
      className="min-h-dvh bg-[#0a0d14] text-white"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="border-b border-white/8 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Shield size={16} className="text-sky-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                TrustDrop
              </h1>
              <p className="text-xs text-white/40 leading-none">USDC inheritance vault</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDeployed && (
              <a
                href={`https://explorer.arc.io/address/${TRUSTDROP_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
              >
                <ExternalLink size={11} />
                Contract
              </a>
            )}
            <ConnectKitButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="mb-12 max-w-xl">
          <h2
            className="text-4xl font-bold tracking-tight mb-3 text-balance"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.025em' }}
          >
            Your USDC, secured by proof of life.
          </h2>
          <p className="text-white/50 text-base leading-relaxed text-pretty">
            Lock USDC in a vault. Check in periodically with a post-quantum signature.
            If you stop checking in, your beneficiaries can claim the funds automatically.
            Even a stolen wallet cannot fake a check-in — it takes the offline key card.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-12">
          {[
            {
              step: '01',
              title: 'Create a vault',
              desc: 'Lock USDC, set check-in interval, choose beneficiaries and their shares.',
            },
            {
              step: '02',
              title: 'Check in regularly',
              desc: 'Sign a message with your offline SLH-DSA key card. No key card = no fake check-in.',
            },
            {
              step: '03',
              title: 'Miss a check-in?',
              desc: 'After the grace window, beneficiaries can claim. Or withdraw anytime while active.',
            },
          ].map((item) => (
            <div key={item.step} className="bg-white/4 border border-white/8 rounded-2xl p-5">
              <span className="text-xs font-mono text-sky-500/60 tracking-widest">{item.step}</span>
              <h3 className="font-semibold text-white mt-2 mb-1.5">{item.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Not deployed notice */}
        {!isDeployed && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-8 text-sm text-amber-300/80">
            Contract not yet deployed to Arc mainnet. Deploy first, then set{' '}
            <code className="font-mono text-amber-300">VITE_TRUSTDROP_ADDRESS</code> in .env.
          </div>
        )}

        {/* Vault list + create */}
        {isDeployed && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white/70 text-sm uppercase tracking-wider">
                All vaults ({vaultCount})
              </h3>
              {isConnected && (
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold
                             hover:bg-sky-400 transition-colors"
                >
                  {showCreate ? <X size={14} /> : <Plus size={14} />}
                  {showCreate ? 'Cancel' : 'New vault'}
                </button>
              )}
            </div>

            {/* Create form */}
            {showCreate && isConnected && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                <h4 className="font-semibold mb-5 text-white/80">Create vault</h4>
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
              <div className="text-center py-16 text-white/30">
                <Shield size={40} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm">No vaults yet. Create the first one.</p>
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

        {/* Connect prompt */}
        {!isConnected && isDeployed && (
          <div className="text-center py-16">
            <p className="text-white/40 text-sm mb-4">Connect your wallet to create a vault.</p>
            <ConnectKitButton />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-6 mt-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/25">
          <p>TrustDrop — built on Arc mainnet with Arc Studio. Unaudited prototype.</p>
          <p>
            Arc uses USDC as gas. Transactions are irreversible.{' '}
            <a
              href="https://docs.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/50 transition-colors"
            >
              docs.arc.io
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
