export type UserRole = 'SUPER_ADMIN' | 'MEMBER';

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'WITHDRAWN';

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';

export type IdentificationType = 'VOTERS_CARD' | 'NIN' | 'NATIONAL_PASSPORT';

export type TransactionType =
  | 'FUNDING'
  | 'SAVINGS'
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_REPAYMENT'
  | 'INVESTMENT'
  | 'WALLET_FUNDING'
  | 'MEMBERSHIP_CHARGE'
  | 'INVESTMENT_DEPOSIT'
  | 'INVESTMENT_RETURN'
  | 'PACKAGE_SUBSCRIPTION'
  | 'PACKAGE_PENALTY'
  | 'MEMBERSHIP_FEE'
  | 'WEEKLY_COOPERATIVE'
  | 'MANUAL_ADJUSTMENT'
  | 'ADMIN_REFUND'
  | 'FEE_WAIVER'
  | 'WALLET_WITHDRAWAL'
  | 'INVESTMENT_CANCELLATION_REFUND';

export type CooperativeEntryType = 'INCOME' | 'EXPENSE';

export type FinancialAccountCode =
  | 'PHYSICAL_TREASURY_CASH'
  | 'MEMBER_WALLET_LIABILITY'
  | 'ASSOCIATION_AVAILABLE';

export type FinancialLineDirection = 'DEBIT' | 'CREDIT';

export type LoanStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DISBURSED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'REJECTED';

export type LoanTenorUnit = 'MONTHS' | 'WEEKS';

export type LoanActivityType = 'AMOUNT_INCREASE' | 'DISBURSEMENT';

export type PackageSubscriptionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DISBURSED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED';
