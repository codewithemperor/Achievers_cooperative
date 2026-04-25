export type UserRole = 'SUPER_ADMIN' | 'MEMBER';

export type MemberStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

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
  | 'PACKAGE_PENALTY';

export type CooperativeEntryType = 'INCOME' | 'EXPENSE';
