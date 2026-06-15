// A realistic demo report so the app is fully usable without uploading a real
// PDF (and so it works without an API key during development/preview).
export const SAMPLE_REPORT = {
  bureau: "Experian",
  reportDate: "2026-06-01",
  providedScore: 622,
  scoreModel: "FICO 8",
  accounts: [
    { id: "a1", creditor: "Capital One Platinum", type: "revolving", balance: 940, creditLimit: 1000, opened: "2021-04", status: "open", worstStatus: "current", late30: 0, late60: 0, late90: 0, pastDue: 0 },
    { id: "a2", creditor: "Chase Freedom", type: "revolving", balance: 3200, creditLimit: 5000, opened: "2019-08", status: "open", worstStatus: "late30", late30: 2, late60: 0, late90: 0, pastDue: 0 },
    { id: "a3", creditor: "Discover It", type: "revolving", balance: 410, creditLimit: 4000, opened: "2023-02", status: "open", worstStatus: "current", late30: 0, late60: 0, late90: 0, pastDue: 0 },
    { id: "a4", creditor: "Toyota Financial", type: "auto", balance: 14200, creditLimit: null, monthlyPayment: 389, opened: "2022-06", status: "open", worstStatus: "current", late30: 1, late60: 0, late90: 0, pastDue: 0 },
    { id: "a5", creditor: "Old Navy Card", type: "revolving", balance: 780, creditLimit: 800, opened: "2024-11", status: "open", worstStatus: "current", late30: 0, late60: 0, late90: 0, pastDue: 0 },
    { id: "a6", creditor: "Midland Funding", type: "other", balance: 0, creditLimit: null, opened: "2018-03", status: "closed", worstStatus: "chargeoff", late30: 0, late60: 0, late90: 1, pastDue: 0, dateFirstDelinquency: "2018-05" },
  ],
  collections: [
    { id: "c1", agency: "Portfolio Recovery", originalCreditor: "Verizon Wireless", balance: 612, status: "unpaid", dateOpened: "2023-09", dateFirstDelinquency: "2023-06" },
    { id: "c2", agency: "ACME Medical Billing", originalCreditor: "City Hospital", balance: 240, status: "unpaid", dateOpened: "2017-02", dateFirstDelinquency: "2016-12" },
  ],
  inquiries: [
    { creditor: "Rocket Mortgage", date: "2026-05-12", type: "hard" },
    { creditor: "Capital One", date: "2026-03-02", type: "hard" },
    { creditor: "Best Buy / Citi", date: "2025-01-18", type: "hard" },
  ],
  publicRecords: [],
  personalInfoFlags: [],
};
