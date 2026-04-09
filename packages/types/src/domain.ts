export type UserRole = "SUPER_ADMIN" | "ADMIN" | "AUDITOR" | "MEMBER";

export interface MemberProfile {
  id: string;
  membershipNumber: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  joinedAt: string;
}

export interface Wallet {
  id: string;
  memberId: string;
  availableBalance: number;
  pendingBalance: number;
  currency: "NGN";
}

export interface Transaction {
  id: string;
  walletId: string;
  type: "FUNDING" | "SAVINGS" | "LOAN_DISBURSEMENT" | "LOAN_REPAYMENT" | "INVESTMENT";
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface LoanApplication {
  id: string;
  memberId: string;
  amount: number;
  tenorMonths: number;
  purpose: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
}

export interface SavingsAccount {
  id: string;
  memberId: string;
  balance: number;
  contributionFrequency: "MONTHLY" | "QUARTERLY" | "FLEXIBLE";
}

export interface InvestmentProduct {
  id: string;
  name: string;
  annualRate: number;
  minimumAmount: number;
  durationMonths: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface InvestmentSubscription {
  id: string;
  memberId: string;
  productId: string;
  principal: number;
  maturityDate: string;
  status: "PENDING" | "ACTIVE" | "MATURED";
}

export interface Notification {
  id: string;
  userId: string;
  channel: "EMAIL" | "SMS" | "IN_APP" | "PUSH";
  title: string;
  message: string;
  readAt?: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}
