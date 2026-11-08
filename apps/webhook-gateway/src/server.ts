import crypto from "crypto";
import express, { Request, Response, NextFunction } from "express";
import { BorrowerIntake, evaluateIndianaAssistance } from "@orchestrator/rules-engine";
import { buildMismo34Xml } from "@orchestrator/mismo-mapper";
import { dispatchToTopLenders } from "@orchestrator/lender-connectors";
import { startEscrowWatcher } from "@orchestrator/token-settlement";

const app = express();
app.use(express.json({
  verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  }
}));

const HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || "dev_secret";

function verifyHmacSignature(req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) {
  const signature = req.header("X-Webhook-Signature");
  if (!signature || !req.rawBody) {
    res.status(401).json({ error: "Missing webhook signature" });
    return;
  }

  const expected = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(req.rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    res.status(403).json({ error: "Invalid HMAC signature" });
    return;
  }

  next();
}

// 1. End-to-End Application Intake -> State Assistance -> MISMO 3.4 -> Top 5 Lenders
app.post("/api/applications/originate", async (req: Request, res: Response) => {
  const applicant = req.body as BorrowerIntake;
  const eligibility = evaluateIndianaAssistance(applicant);

  const selectedProgram = eligibility.matchedPrograms[0]?.code || "STANDARD_FHA";
  const mismoXml = buildMismo34Xml(applicant, selectedProgram);

  const callbackUrl = `${req.protocol}://${req.get("host")}/webhooks/lender-status`;
  const lenderResults = await dispatchToTopLenders(mismoXml, callbackUrl);

  res.status(201).json({
    borrowerId: applicant.borrowerId,
    eligibility,
    selectedProgram,
    lenderResults,
    mismoPreview: mismoXml
  });
});

// 2. Inbound Lender Milestone Webhook (Underwriting, ClearToClose, PayoffConfirmed)
app.post("/webhooks/lender-status", verifyHmacSignature, (req: Request, res: Response) => {
  const { loanTrackingId, lender, milestone, remainingBalanceCents } = req.body;
  console.log(`[LENDER WEBHOOK] ${lender} | Loan ${loanTrackingId} -> ${milestone} (Balance: ${remainingBalanceCents})`);
  res.status(200).json({ received: true });
});

// 3. Inbound Email-to-Webhook Parser (SendGrid / AWS SES fallback for legacy lenders)
app.post("/webhooks/inbound-email", (req: Request, res: Response) => {
  const { from, subject, text } = req.body;
  const loanIdMatch = subject?.match(/TRK-\d+/);
  console.log(`[EMAIL PARSE] From: ${from} | Extracted Loan ID: ${loanIdMatch?.[0] || "UNKNOWN"}`);
  res.status(200).json({ parsed: true, summary: text?.slice(0, 120) });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Home Loan Orchestrator Gateway running on port ${PORT}`);
  startEscrowWatcher();
});
