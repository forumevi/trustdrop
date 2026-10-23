import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { ShieldCheck, ShieldOff, Clock, ArrowDownCircle, LogIn } from 'lucide-react';
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

  if (isSuccess) {
    refetch();
  }

  if (!status) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse h-48" />
    );
  }

  const [owner, balance, lastCheckIn, nextDeadline, lapsed, settled] = status;
  const isOwner = address?.toLowerCase() === owner.toLowerCase();
  const balanceUsd = parseFloat(formatUnits(balance, 6)).toFixed(2);
  const nextDeadlineNum = Number(nextDeadline);
  const countdown = formatCountdown(nextDeadlineNum);

  const statusColor = settled
    ? 'text-gray-400'
    : lapsed
    ? 'text-red-400'
    : 'text-emerald-400';

  const statusLabel = settled ? 'Settled' : lapsed ? 'Lapsed — claimable' : 'Active';
  const StatusIcon = settled ? ShieldOff : lapsed ? ShieldOff : ShieldCheck;

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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 hover:bg-white/8 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/40 tracking-widest uppercase">Vault #{vaultId.toString()}</span>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
          <StatusIcon size={13} />
          {statusLabel}
        </div>
      </div>

      {/* Balance */}
      <div>
        <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
          ${balanceUsd}
        </p>
        <p className="text-xs text-white/40 mt-0.5">USDC locked</p>
      </div>

      {/* Timeline */}
      {!settled && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/40 mb-1 flex items-center gap-1">
              <LogIn size={11} /> Last check-in
            </p>
            <p className="text-white font-medium">{formatTs(Number(lastCheckIn))}</p>
          </div>
          <div className={`bg-white/5 rounded-xl p-3 ${lapsed ? 'ring-1 ring-red-500/40' : ''}`}>
            <p className="text-white/40 mb-1 flex items-center gap-1">
              <Clock size={11} /> {lapsed ? 'Lapsed since' : 'Next deadline in'}
            </p>
            <p className={`font-medium tabular-nums ${lapsed ? 'text-red-400' : 'text-white'}`}>
              {lapsed ? formatTs(nextDeadlineNum) : countdown}
            </p>
          </div>
        </div>
      )}

      {/* Beneficiaries */}
      {beneficiaryData && beneficiaryData[0].length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-white/40 uppercase tracking-wider">Beneficiaries</p>
          {beneficiaryData[0].map((addr, i) => (
            <div key={addr} className="flex items-center justify-between text-xs">
              <span className="font-mono text-white/60">
                {addr.slice(0, 6)}…{addr.slice(-4)}
              </span>
              <span className="text-white/80 tabular-nums">
                {(Number(beneficiaryData[1][i]) / 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Owner label */}
      {isOwner && !settled && (
        <p className="text-xs text-sky-400/70 flex items-center gap-1">
          <ShieldCheck size={11} /> You own this vault
        </p>
      )}

      {/* Claim button — visible to anyone when lapsed */}
      {lapsed && !settled && (
        <button
          onClick={handleClaim}
          disabled={isPending || isConfirming}
          className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-semibold
                     hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ArrowDownCircle size={16} />
          {isPending || isConfirming ? 'Claiming…' : 'Claim funds'}
        </button>
      )}
    </div>
  );
}
