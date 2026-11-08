export interface BorrowerIntake {
  borrowerId: string;
  firstName: string;
  lastName: string;
  email: string;
  walletAddress: string;
  firstTimeBuyer: boolean;
  creditScore: number;
  annualHouseholdIncome: number;
  monthlyDebtPayments: number;
  county: string;
  purchasePrice: number;
  loanAmount: number;
  isPrimaryResidence: boolean;
  attachmentType: "Attached" | "Detached";
  constructionMethod: "SiteBuilt" | "Manufactured";
}

export interface ProgramMatch {
  code: string;
  name: string;
  maxAssistanceAmount: number;
  structure: string;
}

export interface EligibilityResult {
  qualified: boolean;
  backEndDti: number;
  matchedPrograms: ProgramMatch[];
  disqualificationReasons: string[];
}

const COUNTY_LIMITS: Record<string, { incomeLimit: number; acquisitionLimit: number }> = {
  VIGO: { incomeLimit: 96400, acquisitionLimit: 349525 },
  MARION: { incomeLimit: 112500, acquisitionLimit: 425000 },
  DEFAULT: { incomeLimit: 88200, acquisitionLimit: 349525 }
};

export function evaluateIndianaAssistance(applicant: BorrowerIntake): EligibilityResult {
  const reasons: string[] = [];
  const matchedPrograms: ProgramMatch[] = [];

  if (!applicant.isPrimaryResidence) {
    reasons.push("Property must be occupied as the borrower's primary residence.");
  }

  const limits = COUNTY_LIMITS[applicant.county.toUpperCase()] ?? COUNTY_LIMITS.DEFAULT;

  // Estimate PITI at 6.75% 30-yr fixed + taxes/insurance
  const monthlyRate = 0.0675 / 12;
  const principalAndInterest =
    (applicant.loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -360));
  const estimatedEscrow = (applicant.purchasePrice * 0.012) / 12;
  const totalHousingPayment = principalAndInterest + estimatedEscrow;

  const grossMonthlyIncome = applicant.annualHouseholdIncome / 12;
  const backEndDti = Number(
    (((totalHousingPayment + applicant.monthlyDebtPayments) / grossMonthlyIncome) * 100).toFixed(2)
  );

  if (backEndDti > 45) {
    reasons.push(`Back-end DTI (${backEndDti}%) exceeds standard 43–45% program ceiling.`);
  }

  const withinIncome = applicant.annualHouseholdIncome <= limits.incomeLimit;
  const withinAcquisition = applicant.purchasePrice <= limits.acquisitionLimit;

  if (!withinIncome) {
    reasons.push(`Household income exceeds ${applicant.county} limit ($${limits.incomeLimit}).`);
  }

  if (reasons.length === 0 && applicant.creditScore >= 640) {
    if (applicant.firstTimeBuyer && withinAcquisition) {
      matchedPrograms.push({
        code: "IHCDA_FIRST_STEP",
        name: "IHCDA First Step (5% DPA)",
        maxAssistanceAmount: Math.round(applicant.purchasePrice * 0.05),
        structure: "0% deferred non-forgivable second lien"
      });
      matchedPrograms.push({
        code: "IHCDA_STEP_DOWN",
        name: "IHCDA Step Down (Rate Advantage)",
        maxAssistanceAmount: 0,
        structure: "Below-market 30-year fixed rate, no DPA"
      });
    }

    matchedPrograms.push({
      code: "IHCDA_NEXT_HOME",
      name: "IHCDA Next Home (3.5% DPA)",
      maxAssistanceAmount: Math.round(applicant.purchasePrice * 0.035),
      structure: "Forgivable second lien after 3 years occupancy"
    });

    if (applicant.annualHouseholdIncome <= 119850) {
      matchedPrograms.push({
        code: "IHCDA_HOME_SOLUTION",
        name: "IHCDA Indiana Home Solution (Up to 6% DPA)",
        maxAssistanceAmount: Math.round(applicant.purchasePrice * 0.06),
        structure: "Amortizing second mortgage paired with FHA/USDA"
      });
    }
  } else if (applicant.creditScore < 640) {
    reasons.push("Minimum 640 FICO credit score required for IHCDA DPA programs.");
  }

  return {
    qualified: matchedPrograms.length > 0,
    backEndDti,
    matchedPrograms,
    disqualificationReasons: reasons
  };
}
