export interface BorrowerProfile {
  firstTimeBuyer: boolean; // True if no ownership interest in primary residence in past 3 years
  creditScore: number;
  annualHouseholdIncome: number;
  countyAmiLimit: number;
  purchasePrice: number;
  countyAcquisitionLimit: number;
  isPrimaryResidence: boolean;
}

export function evaluateIndianaPrograms(applicant: BorrowerProfile) {
  const eligiblePrograms: string[] = [];

  if (!applicant.isPrimaryResidence) {
    return { eligible: false, eligiblePrograms, reason: "Must be primary residence" };
  }

  const withinIncome = applicant.annualHouseholdIncome <= applicant.countyAmiLimit;
  const withinPrice = applicant.purchasePrice <= applicant.countyAcquisitionLimit;

  if (applicant.firstTimeBuyer && withinIncome && withinPrice && applicant.creditScore >= 640) {
    eligiblePrograms.push("IHCDA_FIRST_STEP_5_PCT", "IHCDA_STEP_DOWN");
  }

  if (withinIncome && withinPrice && applicant.creditScore >= 640) {
    eligiblePrograms.push("IHCDA_NEXT_HOME_3_5_PCT");
  }

  return {
    eligible: eligiblePrograms.length > 0,
    eligiblePrograms,
  };
}
