import { BorrowerIntake } from "@orchestrator/rules-engine";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildMismo34Xml(applicant: BorrowerIntake, assistanceCode: string): string {
  const monthlyIncome = (applicant.annualHouseholdIncome / 12).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xmlns:ULAD="http://www.datamodelextension.org/Schema/ULAD"
         xmlns:DU="http://www.datamodelextension.org/Schema/DU"
         MISMOReferenceModelIdentifier="3.4.032420160128">
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <COLLATERALS>
            <COLLATERAL>
              <SUBJECT_PROPERTY>
                <ADDRESS>
                  <CountyName>${escapeXml(applicant.county)}</CountyName>
                  <StateCode>IN</StateCode>
                </ADDRESS>
                <PROPERTY_DETAIL>
                  <AttachmentType>${applicant.attachmentType}</AttachmentType>
                  <ConstructionMethodType>${applicant.constructionMethod}</ConstructionMethodType>
                  <PropertyEstimatedValueAmount>${applicant.purchasePrice.toFixed(2)}</PropertyEstimatedValueAmount>
                  <PropertyUsageType>PrimaryResidence</PropertyUsageType>
                </PROPERTY_DETAIL>
              </SUBJECT_PROPERTY>
            </COLLATERAL>
          </COLLATERALS>
          <LOANS>
            <LOAN LoanRoleType="SubjectLoan">
              <LOAN_IDENTIFIERS>
                <LOAN_IDENTIFIER>
                  <LoanIdentifier>${escapeXml(applicant.borrowerId)}</LoanIdentifier>
                  <LoanIdentifierType>LenderLoan</LoanIdentifierType>
                </LOAN_IDENTIFIER>
              </LOAN_IDENTIFIERS>
              <TERMS_OF_LOAN>
                <BaseLoanAmount>${applicant.loanAmount.toFixed(2)}</BaseLoanAmount>
                <LoanPurposeType>Purchase</LoanPurposeType>
                <MortgageType>FHA</MortgageType>
              </TERMS_OF_LOAN>
              <GOVERNMENT_LOAN>
                <SectionOfActType>${escapeXml(assistanceCode)}</SectionOfActType>
              </GOVERNMENT_LOAN>
            </LOAN>
          </LOANS>
          <PARTIES>
            <PARTY>
              <INDIVIDUAL>
                <CONTACT_POINTS>
                  <CONTACT_POINT>
                    <CONTACT_POINT_EMAIL>
                      <ContactPointEmailValue>${escapeXml(applicant.email)}</ContactPointEmailValue>
                    </CONTACT_POINT_EMAIL>
                  </CONTACT_POINT>
                </CONTACT_POINTS>
                <NAME>
                  <FirstName>${escapeXml(applicant.firstName)}</FirstName>
                  <LastName>${escapeXml(applicant.lastName)}</LastName>
                </NAME>
              </INDIVIDUAL>
              <ROLES>
                <ROLE>
                  <BORROWER>
                    <CURRENT_INCOME>
                      <CURRENT_INCOME_ITEMS>
                        <CURRENT_INCOME_ITEM>
                          <CURRENT_INCOME_ITEM_DETAIL>
                            <CurrentIncomeMonthlyTotalAmount>${monthlyIncome}</CurrentIncomeMonthlyTotalAmount>
                            <IncomeType>Base</IncomeType>
                          </CURRENT_INCOME_ITEM_DETAIL>
                        </CURRENT_INCOME_ITEM>
                      </CURRENT_INCOME_ITEMS>
                    </CURRENT_INCOME>
                    <DECLARATION>
                      <DECLARATION_DETAIL>
                        <HomeownerPastThreeYearsType>${!applicant.firstTimeBuyer}</HomeownerPastThreeYearsType>
                      </DECLARATION_DETAIL>
                    </DECLARATION>
                  </BORROWER>
                  <ROLE_DETAIL>
                    <PartyRoleType>Borrower</PartyRoleType>
                  </ROLE_DETAIL>
                </ROLE>
              </ROLES>
            </PARTY>
          </PARTIES>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>`;
}
