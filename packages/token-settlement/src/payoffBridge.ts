import { ethers } from "ethers";

const ESCROW_ABI = [
  "event PayoffLocked(bytes32 indexed loanIdHash, address indexed borrower, uint256 lucrAmount, uint256 usdCents)",
  "function finalizeFiatSettlement(bytes32 loanIdHash, string calldata achTraceId) external"
];

export interface PayoffInstruction {
  loanId: string;
  servicerRoutingNumber: string;
  servicerAccountNumber: string;
  usdAmountCents: number;
}

export async function triggerFiatPayoff(instruction: PayoffInstruction): Promise<{ achTraceId: string }> {
  const offRampUrl = process.env.FIAT_OFFRAMP_API_URL || "https://api.payment-bridge.example.com/v1/payouts";
  const offRampKey = process.env.FIAT_OFFRAMP_API_KEY || "sandbox";

  const response = await fetch(offRampUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${offRampKey}`
    },
    body: JSON.stringify({
      rail: "FEDWIRE_OR_ACH",
      reference: instruction.loanId,
      amountCents: instruction.usdAmountCents,
      destination: {
        routingNumber: instruction.servicerRoutingNumber,
        accountNumber: instruction.servicerAccountNumber
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Off-ramp payout failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { traceId: string };
  return { achTraceId: data.traceId };
}

export function startEscrowWatcher() {
  const rpcUrl = process.env.LUCR_RPC_URL;
  const contractAddress = process.env.LUCR_ESCROW_CONTRACT;
  const privateKey = process.env.LUCR_TREASURY_PRIVATE_KEY;

  if (!rpcUrl || !contractAddress || !privateKey) {
    console.warn("LUCR escrow environment variables not configured; watcher running in dry-run mode.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const escrowContract = new ethers.Contract(contractAddress, ESCROW_ABI, wallet);

  escrowContract.on("PayoffLocked", async (loanIdHash: string, borrower: string, lucrAmount: bigint, usdCents: bigint) => {
    console.log(`Locked ${lucrAmount.toString()} LUCR from ${borrower} for loan ${loanIdHash}`);

    const { achTraceId } = await triggerFiatPayoff({
      loanId: loanIdHash,
      servicerRoutingNumber: "021000021",
      servicerAccountNumber: "9876543210",
      usdAmountCents: Number(usdCents)
    });

    const tx = await escrowContract.finalizeFiatSettlement(loanIdHash, achTraceId);
    await tx.wait();
    console.log(`Settled loan ${loanIdHash} on-chain with ACH/Wire trace ${achTraceId}`);
  });
}
