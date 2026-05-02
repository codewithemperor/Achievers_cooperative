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
  | 'FEE_WAIVER';

export type CooperativeEntryType = 'INCOME' | 'EXPENSE';

export type LoanStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DISBURSED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'REJECTED';
