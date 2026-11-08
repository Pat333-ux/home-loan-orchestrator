export interface LenderSubmissionResult {
  lender: string;
  loanTrackingId: string;
  status: "SUBMITTED" | "FAILED";
  webhookCallbackUrl: string;
  error?: string;
}

interface LenderEndpointConfig {
  name: string;
  url: string;
  authHeader: string;
}

const TOP_5_LENDERS: LenderEndpointConfig[] = [
  {
    name: "Rocket Mortgage (Rocket Pro TPO)",
    url: process.env.ROCKET_TPO_API_URL || "https://api.rocketprotpo.com/v1/loans",
    authHeader: `Bearer ${process.env.ROCKET_TPO_CLIENT_SECRET || "sandbox"}`
  },
  {
    name: "United Wholesale Mortgage (UWM)",
    url: process.env.UWM_API_URL || "https://api.uwm.com/v1/originations",
    authHeader: `ApiKey ${process.env.UWM_API_KEY || "sandbox"}`
  },
  {
    name: "Pennymac Correspondent",
    url: process.env.PENNYMAC_API_URL || "https://api.pennymac.com/correspondent/v1/mismo",
    authHeader: `ApiKey ${process.env.PENNYMAC_API_KEY || "sandbox"}`
  },
  {
    name: "AmeriHome Mortgage (Encompass Connect)",
    url: process.env.ENCOMPASS_API_URL || "https://api.elliemae.com/encompass/v3/loans",
    authHeader: `Bearer ${process.env.ENCOMPASS_TOKEN || "sandbox"}`
  },
  {
    name: "CrossCountry Mortgage (Encompass Connect)",
    url: process.env.ENCOMPASS_API_URL || "https://api.elliemae.com/encompass/v3/loans",
    authHeader: `Bearer ${process.env.ENCOMPASS_TOKEN || "sandbox"}`
  }
];

export async function dispatchToTopLenders(
  mismoXml: string,
  webhookCallbackUrl: string
): Promise<LenderSubmissionResult[]> {
  const submissions = TOP_5_LENDERS.map(async (lender): Promise<LenderSubmissionResult> => {
    try {
      const response = await fetch(lender.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          "Authorization": lender.authHeader,
          "X-Webhook-Callback-Url": webhookCallbackUrl
        },
        body: mismoXml
      });

      if (!response.ok) {
        return {
          lender: lender.name,
          loanTrackingId: "",
          status: "FAILED",
          webhookCallbackUrl,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = (await response.json()) as { loanId?: string };
      return {
        lender: lender.name,
        loanTrackingId: data.loanId || `TRK-${Date.now()}`,
        status: "SUBMITTED",
        webhookCallbackUrl
      };
    } catch (err) {
      return {
        lender: lender.name,
        loanTrackingId: "",
        status: "FAILED",
        webhookCallbackUrl,
        error: err instanceof Error ? err.message : "Network error"
      };
    }
  });

  return Promise.all(submissions);
}
