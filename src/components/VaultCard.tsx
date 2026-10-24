import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { ShieldCheck, ShieldOff, Clock, LogIn, ArrowDownCircle, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TRUSTDROP_ABI, TRUSTDROP_ADDRESS, formatTs, formatCountdown } from '@/lib/trustdrop';

interface VaultCardProps {
  vaultId: bigint;
}

export function VaultCard({ vaultId }: VaultCardProps) {
  const { address } = useAccount();

  const { data: status, refetch } = useReadContract({
    address: TRUSTDROP_ADDRESS,
    abi: TRUSTDROP_ABI,
    functionName: 'vaultStatus',
    args: [vaultId],
  }) as { data: [string, bigint, bigint, bigint, boolean, boolean] | undefined; refetch: () => void };

  const { data: beneficiaryData } = useReadContract({
    address: TRUSTDROP_ADDRESS,
    abi: TRUSTDROP_ABI,
    functionName: 'getBeneficiaries',
    args: [vaultId],
  }) as { data: [string[], bigint[]] | undefined };

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) refetch();

  if (!status) {
    return (
      <div
        className="rounded-2xl p-5 h-52 animate-pulse"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      />
    );
  }

  const [owner, balance, lastCheckIn, nextDeadline, lapsed, settled] = status;
  const isOwner = address?.toLowerCase() === owner.toLowerCase();
  const balanceUsd = parseFloat(formatUnits(balance, 6)).toFixed(2);
  const nextDeadlineNum = Number(nextDeadline);
  const countdown = formatCountdown(nextDeadlineNum);

  const statusColor = settled
    ? 'var(--subtle)'
    : lapsed
    ? 'var(--danger)'
    : 'var(--success)';

  const statusLabel = settled ? 'Settled' : lapsed ? 'Lapsed' : 'Active';
  const StatusIcon = settled || lapsed ? ShieldOff : ShieldCheck;

  function handleClaim() {
    writeContract(
      { address: TRUSTDROP_ADDRESS, abi: TRUSTDROP_ABI, functionName: 'claim', args: [vaultId] },
      {
        onError: (e) => toast.error(e.message.slice(0, 80)),
        onSuccess: () => toast.success('Claim submitted'),
      }
    );
  }



  return (
    <div
      className="rounded-2xl p-5 space-y-4 transition-all"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${lapsed && !settled ? 'rgba(248,113,113,0.30)' : 'var(--border)'}`,
      }}
      onMouseEnter={(e) => ((e.currentTarget).style.background = 'var(--surface-strong)')}
      onMouseLeave={(e) => ((e.currentTarget).style.background = 'var(--surface)')}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span
          className="mono text-xs tracking-widest uppercase"
          style={{ color: 'var(--subtle)' }}
        >
          Vault #{vaultId.toString()}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: statusColor }}>
          <StatusIcon size={12} />
          {statusLabel}
        </div>
      </div>

      {/* Balance */}
      <div>
        <p
          className="display text-3xl font-bold tabular-nums"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          ${balanceUsd}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>USDC locked</p>
      </div>

      {/* Timeline */}
      {!settled && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
            <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--subtle)' }}>
              <LogIn size={10} /> Last check-in
            </p>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
              {formatTs(Number(lastCheckIn))}
            </p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: lapsed ? 'rgba(248,113,113,0.08)' : 'var(--surface-muted)',
              border: lapsed ? '1px solid rgba(248,113,113,0.25)' : 'none',
            }}
          >
            <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--subtle)' }}>
              <Clock size={10} /> {lapsed ? 'Lapsed' : 'Next deadline'}
            </p>
            <p
              className="text-xs font-semibold tabular-nums"
              style={{ color: lapsed ? 'var(--danger)' : 'var(--ink-2)' }}
            >
              {lapsed ? formatTs(nextDeadlineNum) : countdown}
            </p>
          </div>
        </div>
      )}

      {/* Beneficiaries */}
      {beneficiaryData && beneficiaryData[0].length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--subtle)', opacity: 0.7 }}>
            Beneficiaries
          </p>
          <div className="space-y-1.5">
            {beneficiaryData[0].map((addr, i) => (
              <div key={addr} className="flex items-center justify-between">
                <span className="mono text-xs" style={{ color: 'var(--muted)' }}>
                  {addr.slice(0, 6)}…{addr.slice(-4)}
                </span>
                <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--ink-2)' }}>
                  {(Number(beneficiaryData[1][i]) / 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner actions */}
      {isOwner && !settled && !lapsed && (
        <div className="space-y-2">
          {/* Check-in info */}
          <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(132,184,232,0.05)', border: '1px solid rgba(132,184,232,0.12)', color: 'var(--subtle)', lineHeight: 1.6 }}>
            <span className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              <RefreshCw size={11} /> How to check in
            </span>
            Check-in requires signing with your SLH-DSA private key offline, then submitting the signature here. Use a dedicated SLH-DSA signing tool and paste the result into the check-in form below.
          </div>
          {/* Withdraw note */}
          <div className="rounded-xl p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', color: 'rgba(248,113,113,0.7)', lineHeight: 1.6 }}>
            <ArrowUpCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>To cancel and withdraw, sign with your SLH-DSA key and call <span className="mono">withdraw()</span> directly. This proves you are alive and reclaims your funds in one step.</span>
          </div>
        </div>
      )}

      {/* Owner badge (settled) */}
      {isOwner && settled && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--subtle)' }}>
          <ShieldCheck size={11} /> Vault settled
        </p>
      )}

      {/* Claim button (beneficiary) */}
      {lapsed && !settled && (
        <button
          onClick={handleClaim}
          disabled={isPending || isConfirming}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            background: 'rgba(248,113,113,0.15)',
            border: '1px solid rgba(248,113,113,0.30)',
            color: 'var(--danger)',
          }}
          onMouseEnter={(e) => ((e.currentTarget).style.background = 'rgba(248,113,113,0.25)')}
          onMouseLeave={(e) => ((e.currentTarget).style.background = 'rgba(248,113,113,0.15)')}
        >
          <ArrowDownCircle size={15} />
          {isPending || isConfirming ? 'Claiming…' : 'Claim funds'}
        </button>
      )}
    </div>
  );
}
