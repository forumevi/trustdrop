import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { PlusCircle, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { TRUSTDROP_ABI, TRUSTDROP_ADDRESS, USDC_ABI, USDC_ADDRESS } from '@/lib/trustdrop';

interface Beneficiary {
  address: string;
  share: string; // percent string, e.g. "50"
}

interface Props {
  onCreated: () => void;
}

const INTERVAL_OPTIONS = [
  { label: '7 days', value: 7 * 86400 },
  { label: '30 days', value: 30 * 86400 },
  { label: '90 days', value: 90 * 86400 },
  { label: '1 year', value: 365 * 86400 },
];

const GRACE_OPTIONS = [
  { label: '3 days', value: 3 * 86400 },
  { label: '7 days', value: 7 * 86400 },
  { label: '14 days', value: 14 * 86400 },
];

export function CreateVaultForm({ onCreated }: Props) {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [pqKey, setPqKey] = useState('');
  const [interval, setInterval] = useState(INTERVAL_OPTIONS[1].value);
  const [grace, setGrace] = useState(GRACE_OPTIONS[1].value);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([{ address: '', share: '100' }]);
  const [step, setStep] = useState<'idle' | 'approving' | 'creating'>('idle');

  // Allowance check
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [address ?? '0x0000000000000000000000000000000000000000', TRUSTDROP_ADDRESS],
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess && step === 'approving') {
    setStep('creating');
    void refetchAllowance();
  }
  if (isSuccess && step === 'creating') {
    setStep('idle');
    toast.success('Vault created.');
    onCreated();
  }

  function totalShares(): number {
    return beneficiaries.reduce((s, b) => s + (parseFloat(b.share) || 0), 0);
  }

  function isValid(): boolean {
    if (!pqKey.startsWith('0x') || pqKey.length !== 66) return false;
    if (!amount || parseFloat(amount) <= 0) return false;
    if (totalShares() !== 100) return false;
    if (beneficiaries.some((b) => !b.address.startsWith('0x') || b.address.length !== 42)) return false;
    return true;
  }

  function addBeneficiary() {
    setBeneficiaries([...beneficiaries, { address: '', share: '0' }]);
  }

  function removeBeneficiary(i: number) {
    setBeneficiaries(beneficiaries.filter((_, idx) => idx !== i));
  }

  function updateBeneficiary(i: number, field: keyof Beneficiary, value: string) {
    setBeneficiaries(beneficiaries.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  }

  function handleSubmit() {
    if (!address || !isValid()) return;

    const amountWei = parseUnits(amount, 6);
    const needsApproval = !allowance || (allowance) < amountWei;

    if (needsApproval) {
      setStep('approving');
      writeContract(
        {
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [TRUSTDROP_ADDRESS, amountWei],
        },
        { onError: (e) => { setStep('idle'); toast.error(e.message.slice(0, 80)); } }
      );
      return;
    }

    setStep('creating');
    writeContract(
      {
        address: TRUSTDROP_ADDRESS,
        abi: TRUSTDROP_ABI,
        functionName: 'createVault',
        args: [
          pqKey as `0x${string}`,
          BigInt(interval),
          BigInt(grace),
          beneficiaries.map((b) => b.address as `0x${string}`),
          beneficiaries.map((b) => BigInt(Math.round((parseFloat(b.share) / 100) * 10000))),
        ],
      },
      { onError: (e) => { setStep('idle'); toast.error(e.message.slice(0, 80)); } }
    );
  }

  const busy = isPending || isConfirming;
  const sharesOk = totalShares() === 100;

  return (
    <div className="space-y-5">
      {/* PQ Key */}
      <div>
        <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
          Post-Quantum Public Key (SLH-DSA, 32 bytes)
        </label>
        <input
          value={pqKey}
          onChange={(e) => setPqKey(e.target.value)}
          placeholder="0x..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono
                     text-white placeholder-white/20 focus:outline-none focus:border-sky-500/50"
        />
        <p className="mt-1.5 text-xs text-white/30 flex items-center gap-1">
          <Info size={11} />
          Generate with the SLH-DSA key tool. Keep your private key offline.
        </p>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
          Initial deposit (USDC)
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-2xl font-bold
                       text-white placeholder-white/20 focus:outline-none focus:border-sky-500/50 pr-20 tabular-nums"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">USDC</span>
        </div>
      </div>

      {/* Interval */}
      <div>
        <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
          Check-in interval
        </label>
        <div className="flex gap-2">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setInterval(opt.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors
                ${interval === opt.value
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grace window */}
      <div>
        <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
          Grace window after lapse
        </label>
        <div className="flex gap-2">
          {GRACE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGrace(opt.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors
                ${grace === opt.value
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Beneficiaries */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">
            Beneficiaries
          </label>
          <span className={`text-xs tabular-nums ${sharesOk ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalShares()}% / 100%
          </span>
        </div>
        <div className="space-y-2">
          {beneficiaries.map((b, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={b.address}
                onChange={(e) => updateBeneficiary(i, 'address', e.target.value)}
                placeholder="0x... address"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono
                           text-white placeholder-white/20 focus:outline-none focus:border-sky-500/50"
              />
              <div className="relative w-20">
                <input
                  type="number"
                  value={b.share}
                  onChange={(e) => updateBeneficiary(i, 'share', e.target.value)}
                  min="0"
                  max="100"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white
                             focus:outline-none focus:border-sky-500/50 pr-6 tabular-nums"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">%</span>
              </div>
              {beneficiaries.length > 1 && (
                <button
                  onClick={() => removeBeneficiary(i)}
                  className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addBeneficiary}
          className="mt-2 w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/40
                     text-xs flex items-center justify-center gap-1.5 hover:text-white/70 transition-colors"
        >
          <PlusCircle size={13} />
          Add beneficiary
        </button>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={busy || !isValid() || !address}
        className="w-full py-4 rounded-xl bg-sky-500 text-white font-bold text-sm
                   hover:bg-sky-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy
          ? step === 'approving'
            ? 'Approving USDC…'
            : 'Creating vault…'
          : !address
          ? 'Connect wallet first'
          : 'Create vault'}
      </button>
    </div>
  );
}
