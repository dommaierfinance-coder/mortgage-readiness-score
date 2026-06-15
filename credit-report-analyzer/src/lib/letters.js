// Templated dispute / goodwill / pay-for-delete letters. Generated client-side
// from the report data — no AI needed, so they're free and instant. The user
// fills in the bracketed personal fields before mailing.

const HEADER = (sender) =>
  `${sender.name || "[Your Name]"}\n${sender.address || "[Your Address]"}\n${sender.cityStateZip || "[City, State ZIP]"}\n${sender.ssnLast4 ? "SSN (last 4): " + sender.ssnLast4 : "SSN (last 4): [____]"}\nDate: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}\n`;

export const LETTER_TYPES = [
  { id: "dispute", label: "Dispute (inaccurate item)", to: "credit bureau" },
  { id: "goodwill", label: "Goodwill (remove paid/late item)", to: "creditor" },
  { id: "payfordelete", label: "Pay-for-delete (open collection)", to: "collection agency" },
  { id: "validation", label: "Debt validation (unknown debt)", to: "collection agency" },
];

export function buildLetter(type, item, sender = {}) {
  const name = sender.name || "[Your Name]";
  const creditor = item?.creditor || "[Creditor / Agency Name]";
  const acct = "[Account Number]";

  switch (type) {
    case "dispute":
      return `${HEADER(sender)}
To: [Credit Bureau — Equifax / Experian / TransUnion]
[Bureau Mailing Address]

Re: Dispute of inaccurate information — ${creditor}

To Whom It May Concern:

I am writing to dispute the following item appearing on my credit report. After reviewing my report, I have found the entry below to be inaccurate and request that it be investigated and corrected or removed under the Fair Credit Reporting Act (15 U.S.C. § 1681i).

  • Creditor / furnisher: ${creditor}
  • Account number: ${acct}
  • Reason for dispute: This item is inaccurate / not mine / past the 7-year reporting period.

Please conduct a reasonable investigation, contact the furnisher, and provide me with the results in writing. If the information cannot be verified, it must be deleted from my file. Please also send an updated copy of my credit report once the investigation is complete.

Sincerely,
${name}`;

    case "goodwill":
      return `${HEADER(sender)}
To: ${creditor}
[Creditor Mailing Address]

Re: Goodwill request — Account ${acct}

Dear ${creditor},

I have been a customer and value my relationship with your company. I am writing to respectfully request a goodwill adjustment to the reporting of my account.

The account is now in good standing, but my credit report reflects a negative mark from a difficult period. I take full responsibility, and I have since brought everything current and kept it that way.

I am working toward qualifying for a mortgage, and removing this isolated mark would make a meaningful difference. I would be deeply grateful if you would, as a gesture of goodwill, remove the negative entry for account ${acct} from all three credit bureaus.

Thank you for considering my request.

Sincerely,
${name}`;

    case "payfordelete":
      return `${HEADER(sender)}
To: ${creditor}
[Collection Agency Mailing Address]

Re: Settlement offer in exchange for deletion — Account ${acct}

To Whom It May Concern:

I am writing regarding the above account. Without admitting liability, I am willing to pay to resolve this matter in exchange for the complete removal of this account from my credit reports with Equifax, Experian, and TransUnion.

This is not an acknowledgment of the debt. My offer is contingent on the following terms, to be agreed in writing BEFORE any payment is made:

  1. You will delete — not merely mark "paid" — all references to this account from every credit bureau.
  2. You will provide written confirmation of these terms on company letterhead.
  3. Upon my payment, you will request deletion within 10 business days.

Please send written agreement to these terms to my address above. I look forward to resolving this.

Sincerely,
${name}`;

    case "validation":
      return `${HEADER(sender)}
To: ${creditor}
[Collection Agency Mailing Address]

Re: Debt validation request — Account ${acct}

To Whom It May Concern:

I am requesting validation of the alleged debt referenced above, pursuant to my rights under the Fair Debt Collection Practices Act (15 U.S.C. § 1692g). I do not acknowledge that I owe this debt.

Please provide the following:

  1. The amount of the debt and an itemized breakdown.
  2. The name of the original creditor.
  3. Proof that you own or are authorized to collect this debt.
  4. A copy of the original signed agreement or contract.

Until you provide proper validation, please cease all collection activity and do not report this account to the credit bureaus. If it is already being reported, it must be marked as disputed.

Sincerely,
${name}`;

    default:
      return "";
  }
}
