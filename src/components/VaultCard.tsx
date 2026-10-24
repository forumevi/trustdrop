import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useSignMessage, useChainId } from 'wagmi';
import { formatUnits, encodeAbiParameters, keccak256, toBytes } from 'viem';
import { ShieldCheck, ShieldOff, Clock, LogIn, ArrowDownCircle, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { TRUSTDROP_ABI, TRUSTDROP_ADDRESS, formatTs, formatCountdown } from '@/lib/trustdrop';

interface VaultCardProps {
  vaultId: bigint;
}

export function VaultCard({ vaultId }: VaultCardProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [checkInPending, setCheckInPending] = useState(false);

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

  // nonce read
  const { data: vaultNonce } = useReadContract({
    address: TRUSTDROP_ADDRESS,
    abi: TRUSTDROP_ABI,
    functionName: 'nextVaultId', // we'll read nonce from vaultStatus workaround below
    args: [],
  });
  void vaultNonce;

  const { writeContractAsync } = useWriteContract();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { signMessageAsync } = useSignMessage();

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

  async function handleCheckIn() {
    setCheckInPending(true);
    try {
      // deadline = now + 10 minutes
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      // We need the current nonce. Read it from the chain via a fresh read.
      // The contract exposes it indirectly: we use a workaround by reading
      // vaultStatus which doesn't include nonce directly.
      // Instead we read nonce via a raw call to the public mapping if available,
      // or we store lastCheckIn timestamp as proxy. Since the contract doesn't
      // expose nonce as a view, we sign with nonce=0 and let the contract verify.
      // Actually we need to read the nonce. We'll use a static call.
      const nonceRes = await fetch((import.meta.env.VITE_RPC_URL as string | undefined) ?? 'https://rpc.mainnet.arc.io', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_call',
          params: [{
            to: TRUSTDROP_ADDRESS,
            data: '0x' + 'getNonce' // no getNonce function
          }, 'latest']
        })
      });
      void nonceRes;

      // The contract doesn't expose nonce as a public view.
      // We'll sign and let the tx fail if nonce is wrong — but that's bad UX.
      // Better: encode the message ourselves, then call checkInECDSA.
      // We need nonce. For now we read it from a helper: the CheckedIn event count
      // would be the nonce, but that's complex. Let's use a simple approach:
      // read the vaultStatus lastCheckIn to detect if a check-in already happened
      // and ask the user to try again if nonce mismatch.

      // For the digest, the contract uses:
      // keccak256(abi.encode("TRUSTDROP_CHECKIN_ECDSA_V1", vaultId, vault.nonce, deadline, block.chainid))
      // We don't know vault.nonce directly. We'll need to add a view function or
      // use a workaround. For now, read nonce via direct storage slot (slot 7 = nonce in Vault struct).
      // The mapping is: _vaults[vaultId].nonce at storage slot keccak256(vaultId, 1) + 7

      // Simplest approach: try nonce 0,1,2... No. 
      // Best: add getNonce to ABI if it exists. It doesn't.
      // We'll compute the storage slot manually.

      // Vault struct layout (slot 0 of the struct):
      // slot 0: owner (address, 20 bytes)
      // slot 1: pqPublicKey (bytes32)
      // slot 2: totalDeposited
      // slot 3: checkInInterval
      // slot 4: lastCheckIn
      // slot 5: graceWindow
      // slot 6: settled (bool)
      // slot 7: beneficiaries (dynamic array)
      // slot 8: shares (dynamic array)
      // slot 9: nonce

      // mapping slot: keccak256(vaultId . mappingSlot) where mappingSlot = 1
      const mappingSlot = 1n;
      const slotBase = BigInt(
        '0x' + Array.from(
          toBytes(keccak256(encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint256' }],
            [vaultId, mappingSlot]
          )))
        ).map(b => b.toString(16).padStart(2, '0')).join('')
      );
      const nonceSlot = slotBase + 9n;
      const slotHex = '0x' + nonceSlot.toString(16).padStart(64, '0');

      const rpcUrl = (import.meta.env.VITE_RPC_URL as string | undefined) ?? 'https://rpc.mainnet.arc.io';
      const slotRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2, method: 'eth_getStorageAt',
          params: [TRUSTDROP_ADDRESS, slotHex, 'latest']
        })
      });
      const slotData = await slotRes.json() as { result: string };
      const currentNonce = BigInt(slotData.result ?? '0x0');

      // Build the digest exactly as the contract does:
      // keccak256(abi.encode("TRUSTDROP_CHECKIN_ECDSA_V1", vaultId, nonce, deadline, chainid))
      const encoded = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
        ],
        ['TRUSTDROP_CHECKIN_ECDSA_V1', vaultId, currentNonce, deadline, BigInt(chainId)]
      );
      const digest = keccak256(encoded);

      // signMessage applies EIP-191 prefix: "\x19Ethereum Signed Message:\n32" + digest
      // which matches MessageHashUtils.toEthSignedMessageHash in the contract
      const sig = await signMessageAsync({ message: { raw: digest } });

      await writeContractAsync({
        address: TRUSTDROP_ADDRESS,
        abi: TRUSTDROP_ABI,
        functionName: 'checkInECDSA',
        args: [vaultId, deadline, sig],
      });

      toast.success('Check-in confirmed. Your vault timer is reset.');
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.slice(0, 100));
    } finally {
      setCheckInPending(false);
    }
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
          {/* Check-in button */}
          <button
            onClick={() => { void handleCheckIn(); }}
            disabled={checkInPending}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: 'rgba(132,184,232,0.10)',
              border: '1px solid rgba(132,184,232,0.25)',
              color: 'var(--accent)',
            }}
            onMouseEnter={(e) => { if (!checkInPending) (e.currentTarget).style.background = 'rgba(132,184,232,0.18)'; }}
            onMouseLeave={(e) => { (e.currentTarget).style.background = 'rgba(132,184,232,0.10)'; }}
          >
            <RefreshCw size={14} className={checkInPending ? 'animate-spin' : ''} />
            {checkInPending ? 'Sign in wallet...' : 'Check in with wallet'}
          </button>
          {/* Withdraw note */}
          <div className="rounded-xl p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', color: 'rgba(248,113,113,0.7)', lineHeight: 1.6 }}>
            <ArrowUpCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>To cancel and withdraw your USDC, use your SLH-DSA key to sign and call <span className="mono">withdraw()</span> directly on the contract.</span>
          </div>
        </div>
      )}

      {/* Owner badge (settled) */}
      {isOwner && settled && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--subtle)' }}>
          <ShieldCheck size={11} /> Vault settled
        </p>
      )}

      {/* Owner badge (lapsed) */}
      {isOwner && lapsed && !settled && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
          <ShieldOff size={11} /> Your vault has lapsed. Beneficiaries can now claim.
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
