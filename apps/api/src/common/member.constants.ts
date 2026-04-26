import type { IdentificationType, MaritalStatus, MemberStatus, TransactionType } from './prisma-types';

export const NIGERIAN_PHONE_REGEX = /^0\d{10}$/;

export const MEMBER_STATUS_OPTIONS: MemberStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'WITHDRAWN'];
export const MARITAL_STATUS_OPTIONS: MaritalStatus[] = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];
export const IDENTIFICATION_TYPE_OPTIONS: IdentificationType[] = ['VOTERS_CARD', 'NIN', 'NATIONAL_PASSPORT'];
export const NON_ACTIVE_MEMBER_STATUSES = new Set<MemberStatus>(['INACTIVE', 'SUSPENDED', 'WITHDRAWN']);

export const LOCKED_TRANSACTION_TYPES = new Set<TransactionType>([
  'WALLET_FUNDING',
  'LOAN_REPAYMENT',
  'MEMBERSHIP_FEE',
  'WEEKLY_COOPERATIVE',
  'LOAN_DISBURSEMENT',
]);

export const EDITABLE_TRANSACTION_TYPES = new Set<TransactionType>([
  'MANUAL_ADJUSTMENT',
  'ADMIN_REFUND',
  'FEE_WAIVER',
]);

export function isValidNigerianPhoneNumber(phoneNumber: string) {
  return NIGERIAN_PHONE_REGEX.test(phoneNumber);
}

export function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber.length < 7) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}xxxx${phoneNumber.slice(-4)}`;
}
