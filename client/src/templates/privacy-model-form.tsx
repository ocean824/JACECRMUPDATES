import { forwardRef } from "react";

interface PrivacyFormData {
  institutionName: string;
  revisionDate: string;
  phoneNumber: string;
  website: string;
  mailingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  };
  sharingPolicy: {
    everydayBusinessPurposes: { shares: boolean; canLimit: boolean };
    marketingPurposes: { shares: boolean; canLimit: boolean };
    jointMarketing: { shares: boolean; canLimit: boolean };
    affiliatesTransactions: { shares: boolean; canLimit: boolean };
    affiliatesCreditworthiness: { shares: boolean; canLimit: boolean };
    affiliatesMarketing: { shares: boolean; canLimit: boolean };
    nonaffiliatesMarketing: { shares: boolean; canLimit: boolean };
  };
  investorName?: string;
  accountNumber?: string;
}

const defaultFormData: PrivacyFormData = {
  institutionName: "JACE, LLC",
  revisionDate: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  phoneNumber: "(800) 555-JACE",
  website: "www.jacecrm.com/privacy",
  mailingAddress: {
    line1: "Privacy Office",
    line2: "123 Financial Center Drive",
    city: "New York",
    state: "NY",
    zip: "10001",
  },
  sharingPolicy: {
    everydayBusinessPurposes: { shares: true, canLimit: false },
    marketingPurposes: { shares: true, canLimit: false },
    jointMarketing: { shares: false, canLimit: false },
    affiliatesTransactions: { shares: false, canLimit: false },
    affiliatesCreditworthiness: { shares: false, canLimit: false },
    affiliatesMarketing: { shares: false, canLimit: false },
    nonaffiliatesMarketing: { shares: false, canLimit: false },
  },
};

export const PrivacyModelForm = forwardRef<HTMLDivElement, { data?: Partial<PrivacyFormData> }>(
  ({ data = {} }, ref) => {
    const formData = { ...defaultFormData, ...data };
    const { institutionName, revisionDate, phoneNumber, website, mailingAddress, sharingPolicy } = formData;

    const formatSharing = (value: boolean) => (value ? "Yes" : "No");
    const formatLimit = (shares: boolean, canLimit: boolean) => {
      if (!shares) return "We don't share";
      return canLimit ? "Yes" : "No";
    };

    return (
      <div ref={ref} className="bg-white text-black print:text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <style>{`
          @media print {
            @page { size: Letter; margin: 0.55in; }
            .page { page-break-after: always; }
            .page:last-child { page-break-after: auto; }
          }
        `}</style>

        {/* PAGE 1 */}
        <div className="page min-h-[10in] relative p-2">
          <div className="absolute top-0 right-0 text-[9pt]">Rev. {revisionDate}</div>

          {/* FACTS Header */}
          <div className="flex mt-1">
            <div className="w-[1.15in] bg-black text-white font-extrabold text-[18pt] flex items-center justify-center border-2 border-black border-r-0 p-2">
              FACTS
            </div>
            <div className="flex-1 border-2 border-black p-3 font-extrabold text-[13pt] uppercase">
              WHAT DOES {institutionName} DO<br />
              WITH YOUR PERSONAL INFORMATION?
            </div>
          </div>

          {/* Why/What/How Frame */}
          <div className="border-2 border-black border-t-0 p-3">
            <div className="grid grid-cols-[0.75in_1fr] gap-x-4 mb-2">
              <div className="font-extrabold">Why?</div>
              <div className="text-[10.5pt] leading-tight">
                Financial companies choose how they share your personal information. Federal law gives consumers the right to
                limit some but not all sharing. Federal law also requires us to tell you how we collect, share, and protect
                your personal information. Please read this notice carefully to understand what we do.
              </div>
            </div>

            <div className="grid grid-cols-[0.75in_1fr] gap-x-4 mb-2">
              <div className="font-extrabold">What?</div>
              <div className="text-[10.5pt] leading-tight">
                The types of personal information we collect and share depend on the product or service you have with us.
                This information can include:
                <ul className="ml-5 mt-1 list-disc">
                  <li>Social Security number and investor profile / tax ID</li>
                  <li>Account balances and transaction history</li>
                  <li>Payment/settlement activity and escrow funding records</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-[0.75in_1fr] gap-x-4">
              <div className="font-extrabold">How?</div>
              <div className="text-[10.5pt] leading-tight">
                All financial companies need to share customers' personal information to run their everyday business. In the
                section below, we list the reasons financial companies can share their customers' personal information; the
                reasons {institutionName} chooses to share; and whether you can limit this sharing.
              </div>
            </div>
          </div>

          {/* Disclosure Table */}
          <div className="mt-3">
            <table className="w-full border-collapse border-2 border-black text-[10pt]">
              <thead>
                <tr>
                  <th className="border border-black bg-gray-200 p-2 text-left w-[62%] font-extrabold">
                    Reasons we can share your personal information
                  </th>
                  <th className="border border-black bg-gray-200 p-2 text-left w-[19%] font-extrabold">
                    Does {institutionName} share?
                  </th>
                  <th className="border border-black bg-gray-200 p-2 text-left w-[19%] font-extrabold">
                    Can you limit this sharing?
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2">
                    <span className="font-bold">For our everyday business purposes—</span><br />
                    such as to process your transactions, maintain your account(s), respond to court orders and legal
                    investigations, or report as required
                  </td>
                  <td className="border border-black p-2">{formatSharing(sharingPolicy.everydayBusinessPurposes.shares)}</td>
                  <td className="border border-black p-2">{formatLimit(sharingPolicy.everydayBusinessPurposes.shares, sharingPolicy.everydayBusinessPurposes.canLimit)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">
                    <span className="font-bold">For our marketing purposes—</span><br />to offer our products and services to you
                  </td>
                  <td className="border border-black p-2">{formatSharing(sharingPolicy.marketingPurposes.shares)}</td>
                  <td className="border border-black p-2">{formatLimit(sharingPolicy.marketingPurposes.shares, sharingPolicy.marketingPurposes.canLimit)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">
                    <span className="font-bold">For joint marketing with other financial companies</span>
                  </td>
                  <td className="border border-black p-2">{formatSharing(sharingPolicy.jointMarketing.shares)}</td>
                  <td className="border border-black p-2">{formatLimit(sharingPolicy.jointMarketing.shares, sharingPolicy.jointMarketing.canLimit)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">
                    <span className="font-bold">For our affiliates' everyday business purposes—</span><br />
                    information about your transactions and experiences
                  </td>
                  <td className="border border-black p-2">{formatSharing(sharingPolicy.affiliatesTransactions.shares)}</td>
                  <td className="border border-black p-2">{formatLimit(sharingPolicy.affiliatesTransactions.shares, sharingPolicy.affiliatesTransactions.canLimit)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">
                    <span className="font-bold">For our affiliates' everyday business purposes—</span><br />
                    information about your creditworthiness
                  </td>
                  <td className="border border-black p-2">{formatSharing(sharingPolicy.affiliatesCreditworthiness.shares)}</td>
                  <td className="border border-black p-2">{formatLimit(sharingPolicy.affiliatesCreditworthiness.shares, sharingPolicy.affiliatesCreditworthiness.canLimit)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">
                    <span className="font-bold">For our affiliates to market to you</span>
                  </td>
                  <td className="border border-black p-2">{formatSharing(sharingPolicy.affiliatesMarketing.shares)}</td>
                  <td className="border border-black p-2">{formatLimit(sharingPolicy.affiliatesMarketing.shares, sharingPolicy.affiliatesMarketing.canLimit)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">
                    <span className="font-bold">For nonaffiliates to market to you</span>
                  </td>
                  <td className="border border-black p-2">{formatSharing(sharingPolicy.nonaffiliatesMarketing.shares)}</td>
                  <td className="border border-black p-2">{formatLimit(sharingPolicy.nonaffiliatesMarketing.shares, sharingPolicy.nonaffiliatesMarketing.canLimit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* To Limit / Questions */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="border-2 border-black p-3">
              <div className="grid grid-cols-[1.05in_1fr] gap-3">
                <div className="font-extrabold">To limit<br />our sharing</div>
                <div>
                  <ul className="ml-5 list-disc text-[10pt]">
                    <li>Call <span className="font-bold">{phoneNumber}</span> — our menu will prompt you through your choice(s)</li>
                    <li>Visit us online: <span className="font-bold">{website}</span> or</li>
                    <li>Mail the form below</li>
                  </ul>
                  <div className="text-[9pt] mt-2">
                    <span className="font-bold">Please note:</span><br />
                    If you are a new customer, we can begin sharing your information 30 days from the date we sent this notice.
                    When you are no longer our customer, we continue to share your information as described in this notice.
                    However, you can contact us at any time to limit our sharing.
                  </div>
                </div>
              </div>
            </div>
            <div className="border-2 border-black p-3">
              <div className="font-extrabold mb-1">Questions?</div>
              <div className="text-[10pt]">Call <span className="font-bold">{phoneNumber}</span> or go to <span className="font-bold">{website}</span></div>
            </div>
          </div>

          {/* Mail-in Form */}
          <div className="text-[12pt] mt-3">✂</div>
          <div className="border-t-2 border-dashed border-black my-1"></div>

          <div className="border-2 border-black p-3">
            <div className="grid grid-cols-[1fr_1.6fr] gap-3">
              <div className="font-extrabold">Mail-in Form</div>
              <div className="text-right text-[9pt] font-bold">Leave Blank</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <div className="text-[9pt]">
                  OR<br />
                  If you have a joint account, your choice(s) will apply to everyone on your account unless you mark below.<br />
                  ☐ Apply my choices only to me
                </div>

                <div className="font-bold mt-2 text-[10pt]">Mark any/all you want to limit:</div>
                <div className="text-[9pt] mt-1 space-y-1">
                  <div>☐ Do not share information about my creditworthiness with your affiliates for their everyday business purposes.</div>
                  <div>☐ Do not allow your affiliates to use my personal information to market to me.</div>
                  <div>☐ Do not share my personal information with nonaffiliates to market their products and services to me.</div>
                </div>

                <div className="mt-3 space-y-2 text-[10pt]">
                  <div>
                    <div className="font-bold">Name</div>
                    <div className="border-b border-black h-4"></div>
                  </div>
                  <div>
                    <div className="font-bold">Address</div>
                    <div className="border-b border-black h-4"></div>
                  </div>
                  <div>
                    <div className="font-bold">City, State, Zip</div>
                    <div className="border-b border-black h-4"></div>
                  </div>
                  <div>
                    <div className="font-bold">Account #</div>
                    <div className="border-b border-black h-4"></div>
                  </div>
                </div>
              </div>

              <div className="border-l-2 border-black pl-3">
                <div className="font-bold">Mail to:</div>
                <div className="mt-1 text-[10pt]">
                  <div>{institutionName}</div>
                  <div>{mailingAddress.line1}</div>
                  {mailingAddress.line2 && <div>{mailingAddress.line2}</div>}
                  <div>{mailingAddress.city}, {mailingAddress.state} {mailingAddress.zip}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 2 */}
        <div className="page min-h-[10in] p-2">
          <div className="font-extrabold text-[12pt] mb-3">Page 2</div>

          {/* Who we are */}
          <div className="font-extrabold text-[12pt] mb-2">Who we are</div>
          <div className="border-2 border-black">
            <div className="grid grid-cols-[1.65in_1fr]">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">Who is providing this notice?</div>
              <div className="p-2 text-[10pt]">
                {institutionName} and its regulated escrow/payment/settlement partners used to support onboarding and transactions.
              </div>
            </div>
          </div>

          {/* What we do */}
          <div className="font-extrabold text-[12pt] mt-3 mb-2">What we do</div>
          <div className="border-2 border-black">
            <div className="grid grid-cols-[1.65in_1fr] border-b border-black">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">
                How does {institutionName} protect my personal information?
              </div>
              <div className="p-2 text-[10pt]">
                To protect your personal information from unauthorized access and use, we use security measures that comply with federal law.
                These measures include computer safeguards and secured files and buildings.<br /><br />
                Additional safeguards include role-based access control (RBAC), comprehensive audit logging, encryption at rest and in transit, and continuous security monitoring.
              </div>
            </div>

            <div className="grid grid-cols-[1.65in_1fr] border-b border-black">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">
                How does {institutionName} collect my personal information?
              </div>
              <div className="p-2 text-[10pt]">
                We collect your personal information, for example, when you:
                <ul className="ml-5 mt-1 list-disc">
                  <li>Open an account or onboard as an investor</li>
                  <li>Fund escrow or enter a bid</li>
                  <li>Participate in settlement or make a payment</li>
                  <li>Use the investor portal or contact customer support</li>
                </ul>
                We also collect your personal information from others, such as identity verification providers, affiliates, or other companies.
              </div>
            </div>

            <div className="grid grid-cols-[1.65in_1fr] border-b border-black">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">
                Why can't I limit all sharing?
              </div>
              <div className="p-2 text-[10pt]">
                Federal law gives you the right to limit only:
                <ul className="ml-5 mt-1 list-disc">
                  <li>Sharing for affiliates' everyday business purposes—information about your creditworthiness</li>
                  <li>Affiliates from using your information to market to you</li>
                  <li>Sharing for nonaffiliates to market to you</li>
                </ul>
                State laws and individual companies may give you additional rights to limit sharing.
              </div>
            </div>

            <div className="grid grid-cols-[1.65in_1fr]">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">
                What happens when I limit sharing for an account I hold jointly with someone else?
              </div>
              <div className="p-2 text-[10pt]">
                Your choices will apply to everyone on your account—unless you tell us otherwise.
              </div>
            </div>
          </div>

          {/* Definitions */}
          <div className="font-extrabold text-[12pt] mt-3 mb-2">Definitions</div>
          <div className="border-2 border-black">
            <div className="grid grid-cols-[1.35in_1fr] border-b border-black">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">Affiliates</div>
              <div className="p-2 text-[10pt]">
                Companies related by common ownership or control. They can be financial and nonfinancial companies.
                <ul className="ml-5 mt-1 list-disc">
                  <li>{institutionName} has no affiliates that receive NPI for marketing.</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-[1.35in_1fr] border-b border-black">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">Nonaffiliates</div>
              <div className="p-2 text-[10pt]">
                Companies not related by common ownership or control. They can be financial and nonfinancial companies.
                <ul className="ml-5 mt-1 list-disc">
                  <li>{institutionName} does not sell NPI; sharing is limited to service providers/partners for processing, compliance, fraud prevention, and security.</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-[1.35in_1fr]">
              <div className="bg-gray-200 font-extrabold p-2 border-r border-black text-[10pt]">Joint marketing</div>
              <div className="p-2 text-[10pt]">
                A formal agreement between nonaffiliated financial companies that together market financial products or services to you.
                <ul className="ml-5 mt-1 list-disc">
                  <li>{institutionName} does not jointly market.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Other important information */}
          <div className="border-2 border-black mt-3 p-2">
            <div className="font-extrabold mb-1 text-[10pt]">Other important information</div>
            <div className="text-[10pt]">
              For questions about your privacy rights or to exercise your choices, contact us at {phoneNumber} or visit {website}.
              Additional state-specific privacy rights may apply depending on your state of residence.
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PrivacyModelForm.displayName = "PrivacyModelForm";

export default PrivacyModelForm;
