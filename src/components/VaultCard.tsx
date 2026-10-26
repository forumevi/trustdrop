import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSignMessage, useChainId } from 'wagmi';
import { formatUnits, encodeAbiParameters, keccak256, toBytes } from 'viem';
import { ShieldCheck, ShieldOff, Clock, LogIn, ArrowDownCircle, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import { TRUSTDROP_ABI, TRUSTDROP_ADDRESS, formatTs, formatCountdown } from '@/lib/trustdrop';

const RPC = 'https://rpc.mainnet.arc.io';

async function ethCall(data: `0x${string}`): Promise<string> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: TRUSTDROP_ADDRESS, data }, 'latest'] }),
  });
  const json = await res.json() as { result?: string };
  return json.result ?? '0x';
}

interface VaultCardProps {
  vaultId: bigint;
  filterOwner?: string;
  nowTs: number;
}

type VaultStatus = [string, bigint, bigint, bigint, boolean, boolean];
type BeneficiaryData = [string[], bigint[]];

export function VaultCard({ vaultId, filterOwner, nowTs }: VaultCardProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [checkInPending, setCheckInPending] = useState(false);
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [beneficiaryData, setBeneficiaryData] = useState<BeneficiaryData | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { signMessageAsync } = useSignMessage();

  const fetchVaultData = useCallback(async () => {
    try {
      // vaultStatus(uint256) selector = 0x00902621
      // getBeneficiaries(uint256) selector = 0x783804d9
      const idHex = vaultId.toString(16).padStart(64, '0');
      const statusData = `0x00902621${idHex}` as `0x${string}`;
      const benData = `0x783804d9${idHex}` as `0x${string}`;

      const [statusHex, benHex] = await Promise.all([ethCall(statusData), ethCall(benData)]);

      if (statusHex && statusHex.length > 2) {
        const { decodeAbiParameters } = await import('viem');
        const decoded = decodeAbiParameters(
          [
            { name: 'owner', type: 'address' },
            { name: 'balance', type: 'uint256' },
            { name: 'lastCheckIn', type: 'uint256' },
            { name: 'nextDeadline', type: 'uint256' },
            { name: 'lapsed', type: 'bool' },
            { name: 'settled', type: 'bool' },
          ],
          statusHex as `0x${string}`
        );
        setStatus([decoded[0], decoded[1], decoded[2], decoded[3], decoded[4], decoded[5]]);
      }

      if (benHex && benHex.length > 2) {
        const { decodeAbiParameters } = await import('viem');
        const decoded = decodeAbiParameters(
          [
            { name: 'addrs', type: 'address[]' },
            { name: 'shares', type: 'uint256[]' },
          ],
          benHex as `0x${string}`
        );
        setBeneficiaryData([decoded[0] as string[], decoded[1] as bigint[]]);
      }
    } catch (e) { console.error('fetchVaultData error:', e); }
  }, [vaultId]);

  useEffect(() => {
    void fetchVaultData();
  }, [fetchVaultData]);

  useEffect(() => {
    if (isSuccess) void fetchVaultData();
  }, [isSuccess, fetchVaultData]);

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

  if (filterOwner && owner.toLowerCase() !== filterOwner.toLowerCase()) return null;

  const checkInNum = Number(lastCheckIn);
  const windowLen = nextDeadlineNum - checkInNum;
  const elapsed = nowTs - checkInNum;
  const progress = windowLen > 0 ? Math.min(elapsed / windowLen, 1) : 1;
  const progressColor = progress > 0.85 ? 'var(--danger)' : progress > 0.6 ? '#f5a623' : 'var(--success)';

  const statusColor = settled ? 'var(--subtle)' : lapsed ? 'var(--danger)' : 'var(--success)';
  const statusLabel = settled ? 'Settled' : lapsed ? 'Lapsed' : 'Active';
  const StatusIcon = settled || lapsed ? ShieldOff : ShieldCheck;

  function handleSettle() {
    writeContract(
      { address: TRUSTDROP_ADDRESS, abi: TRUSTDROP_ABI, functionName: 'settle', args: [vaultId] },
      {
        onError: (e) => toast.error(e.message.slice(0, 80)),
        onSuccess: () => toast.success('Vault settled. Beneficiaries can now claim their shares.'),
      }
    );
  }

  function handleClaimShare() {
    writeContract(
      { address: TRUSTDROP_ADDRESS, abi: TRUSTDROP_ABI, functionName: 'claimShare', args: [vaultId] },
      {
        onError: (e) => toast.error(e.message.slice(0, 80)),
        onSuccess: () => { toast.success('Share claimed successfully.'); void fetchVaultData(); },
      }
    );
  }

  async function handleCheckIn() {
    setCheckInPending(true);
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      const mappingSlot = 1n;
      const slotBase = BigInt('0x' + Array.from(toBytes(keccak256(encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }], [vaultId, mappingSlot]
      )))).map(b => b.toString(16).padStart(2, '0')).join(''));
      const nonceSlot = slotBase + 9n;
      const slotHex = '0x' + nonceSlot.toString(16).padStart(64, '0');
      const slotRes = await fetch(RPC, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getStorageAt', params: [TRUSTDROP_ADDRESS, slotHex, 'latest'] }),
      });
      const slotData = await slotRes.json() as { result?: string };
      const currentNonce = BigInt(slotData.result ?? '0x0');

      const encoded = encodeAbiParameters(
        [{ type: 'string' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
        ['TRUSTDROP_CHECKIN_ECDSA_V1', vaultId, currentNonce, deadline, BigInt(chainId)]
      );
      const digest = keccak256(encoded);
      const sig = await signMessageAsync({ message: { raw: digest } });
      await writeContractAsync({ address: TRUSTDROP_ADDRESS, abi: TRUSTDROP_ABI, functionName: 'checkInECDSA', args: [vaultId, deadline, sig] });
      toast.success('Check-in confirmed. Your vault timer is reset.');
      void fetchVaultData();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)).slice(0, 100));
    } finally {
      setCheckInPending(false);
    }
  }

  async function handleWithdrawECDSA() {
    setWithdrawPending(true);
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      const mappingSlot = 1n;
      const slotBase = BigInt('0x' + Array.from(toBytes(keccak256(encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }], [vaultId, mappingSlot]
      )))).map(b => b.toString(16).padStart(2, '0')).join(''));
      const nonceSlot = slotBase + 9n;
      const slotHex = '0x' + nonceSlot.toString(16).padStart(64, '0');
      const slotRes = await fetch(RPC, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getStorageAt', params: [TRUSTDROP_ADDRESS, slotHex, 'latest'] }),
      });
      const slotData = await slotRes.json() as { result?: string };
      const currentNonce = BigInt(slotData.result ?? '0x0');

      const encoded = encodeAbiParameters(
        [{ type: 'string' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
        ['TRUSTDROP_WITHDRAW_ECDSA_V1', vaultId, currentNonce, deadline, BigInt(chainId)]
      );
      const digest = keccak256(encoded);
      const sig = await signMessageAsync({ message: { raw: digest } });
      await writeContractAsync({ address: TRUSTDROP_ADDRESS, abi: TRUSTDROP_ABI, functionName: 'withdrawECDSA', args: [vaultId, deadline, sig] });
      toast.success('Withdrawal successful. USDC returned to your wallet.');
      void fetchVaultData();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)).slice(0, 100));
    } finally {
      setWithdrawPending(false);
    }
  }

  return (
    <div
      className="vault-card-glow rounded-2xl p-5 space-y-4"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${lapsed && !settled ? 'rgba(248,113,113,0.30)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="mono text-xs tracking-widest uppercase" style={{ color: 'var(--subtle)' }}>
          Vault #{vaultId.toString()}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: statusColor }}>
          <StatusIcon size={12} /> {statusLabel}
        </div>
      </div>

      <div>
        <p className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          ${balanceUsd}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>USDC locked</p>
      </div>

      {!settled && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
              <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--subtle)' }}>
                <LogIn size={10} /> Last check-in
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{formatTs(Number(lastCheckIn))}</p>
            </div>
            <div className="rounded-xl p-3" style={{
              background: lapsed ? 'rgba(248,113,113,0.08)' : 'var(--surface-muted)',
              border: lapsed ? '1px solid rgba(248,113,113,0.25)' : 'none',
            }}>
              <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--subtle)' }}>
                <Clock size={10} /> {lapsed ? 'Lapsed' : 'Next deadline'}
              </p>
              <p className="text-xs font-semibold tabular-nums" style={{ color: lapsed ? 'var(--danger)' : 'var(--ink-2)' }}>
                {lapsed ? formatTs(nextDeadlineNum) : countdown}
              </p>
            </div>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.round(progress * 100)}%`, background: progressColor,
              borderRadius: 99, transition: 'width 1s linear', boxShadow: `0 0 8px ${progressColor}66`,
            }} />
          </div>
        </>
      )}

      {beneficiaryData && beneficiaryData[0].length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--subtle)', opacity: 0.7 }}>Beneficiaries</p>
          <div className="space-y-1.5">
            {beneficiaryData[0].map((addr, i) => (
              <div key={addr} className="flex items-center justify-between">
                <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--ink-2)' }}>
                  {(Number(beneficiaryData[1][i]) / 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && !settled && !lapsed && (
        <div className="space-y-2">
          {(() => {
            const sevenDays = 7 * 24 * 3600;
            const timeLeft = nextDeadlineNum - nowTs;
            const checkInOpen = timeLeft <= sevenDays;
            const daysUntilOpen = checkInOpen ? 0 : Math.ceil((timeLeft - sevenDays) / 86400);
            return checkInOpen ? (
              <button onClick={() => { void handleCheckIn(); }} disabled={checkInPending}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'rgba(132,184,232,0.10)', border: '1px solid rgba(132,184,232,0.25)', color: 'var(--accent)' }}
                onMouseEnter={(e) => { if (!checkInPending) e.currentTarget.style.background = 'rgba(132,184,232,0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(132,184,232,0.10)'; }}>
                <RefreshCw size={14} className={checkInPending ? 'animate-spin' : ''} />
                {checkInPending ? 'Sign in wallet...' : 'Check in with wallet'}
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
                <RefreshCw size={14} />
                Next check-in window opens in {daysUntilOpen} day{daysUntilOpen !== 1 ? 's' : ''}
              </div>
            );
          })()}
          <button onClick={() => { void handleWithdrawECDSA(); }} disabled={withdrawPending}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)', color: 'var(--danger)' }}
            onMouseEnter={(e) => { if (!withdrawPending) e.currentTarget.style.background = 'rgba(248,113,113,0.16)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}>
            <ArrowUpCircle size={14} className={withdrawPending ? 'animate-spin' : ''} />
            {withdrawPending ? 'Sign in wallet...' : 'Withdraw with wallet'}
          </button>
        </div>
      )}

      {isOwner && !settled && !lapsed && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--success)', opacity: 0.7 }}>
          <ShieldCheck size={11} /> You own this vault
        </p>
      )}
      {isOwner && settled && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--subtle)' }}>
          <ShieldCheck size={11} /> Vault settled
        </p>
      )}
      {isOwner && lapsed && !settled && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
          <ShieldOff size={11} /> Your vault has lapsed. Beneficiaries can now claim.
        </p>
      )}

      {lapsed && !settled && (
        <div className="space-y-2">
          <button onClick={handleSettle} disabled={isPending || isConfirming}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--danger)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.20)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.10)'; }}>
            <ShieldOff size={14} />
            {isPending || isConfirming ? 'Processing...' : 'Settle vault (step 1)'}
          </button>
          <button onClick={handleClaimShare} disabled={isPending || isConfirming}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.30)', color: 'var(--danger)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; }}>
            <ArrowDownCircle size={14} />
            {isPending || isConfirming ? 'Claiming...' : 'Claim my share (step 2)'}
          </button>
        </div>
      )}
    </div>
  );
}
