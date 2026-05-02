"use client";

import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowUpCircle,
  BadgeDollarSign,
  Bell,
  BriefcaseBusiness,
  HandCoins,
  Landmark,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { humanizeLabel } from "@/lib/member-format";

interface TransactionTone {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}

interface StatusTone {
  badge: string;
}

const transactionToneMap: Record<string, TransactionTone> = {
  WALLET: {
    icon: <Wallet className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(34,197,94,0.18)]",
    iconColor: "text-[var(--primary-700)]",
  },
  SAVINGS: {
    icon: <PiggyBank className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(34,197,94,0.12)]",
    iconColor: "text-[var(--primary-700)]",
  },
  LOAN: {
    icon: <HandCoins className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(239,68,68,0.14)]",
    iconColor: "text-red-600",
  },
  INVESTMENT: {
    icon: <TrendingUp className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(168,85,247,0.16)]",
    iconColor: "text-violet-600",
  },
  PACKAGE: {
    icon: <BriefcaseBusiness className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(245,158,11,0.16)]",
    iconColor: "text-amber-600",
  },
  TRANSFER: {
    icon: <ArrowLeftRight className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(34,197,94,0.12)]",
    iconColor: "text-[var(--primary-700)]",
  },
  PAYMENT: {
    icon: <BadgeDollarSign className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(20,184,166,0.16)]",
    iconColor: "text-teal-600",
  },
  BANK: {
    icon: <Landmark className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(34,197,94,0.12)]",
    iconColor: "text-[var(--primary-700)]",
  },
  NOTICE: {
    icon: <Bell className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(249,115,22,0.16)]",
    iconColor: "text-orange-600",
  },
  VERIFIED: {
    icon: <ShieldCheck className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(16,185,129,0.14)]",
    iconColor: "text-emerald-600",
  },
  DEFAULT: {
    icon: <ArrowUpCircle className="h-4 w-4" />,
    iconBg: "bg-[color:rgba(148,163,184,0.18)]",
    iconColor: "text-slate-600",
  },
};

const statusToneMap: Record<string, StatusTone> = {
  CONFIRMED: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  APPROVED: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  ACTIVE: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  COMPLETED: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  SUCCESS: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  PENDING: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  PROCESSING: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  DUE: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  REJECTED: { badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  FAILED: { badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  OVERDUE: { badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  CANCELLED: { badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  DISBURSED: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  CURRENT: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  IN_PROGRESS: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  PAID: { badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  DEFAULT: { badge: "bg-[var(--background-100)] text-[var(--text-600)] dark:bg-white/10 dark:text-[var(--text-300)]" },
};

export function getTransactionTone(type?: string | null): TransactionTone {
  const key = (type || "").toUpperCase();

  if (key.includes("SAVING")) return transactionToneMap.SAVINGS;
  if (key.includes("LOAN")) return transactionToneMap.LOAN;
  if (key.includes("INVEST")) return transactionToneMap.INVESTMENT;
  if (key.includes("PACKAGE")) return transactionToneMap.PACKAGE;
  if (key.includes("TRANSFER")) return transactionToneMap.TRANSFER;
  if (key.includes("BANK")) return transactionToneMap.BANK;
  if (key.includes("PAYMENT") || key.includes("FUNDING")) return transactionToneMap.PAYMENT;
  if (key.includes("NOTIFICATION")) return transactionToneMap.NOTICE;
  if (key.includes("PROFILE") || key.includes("VERIFIED")) return transactionToneMap.VERIFIED;
  if (key.includes("WALLET")) return transactionToneMap.WALLET;

  return transactionToneMap.DEFAULT;
}

export function getStatusTone(status?: string | null): StatusTone {
  return statusToneMap[(status || "").toUpperCase()] || statusToneMap.DEFAULT;
}

export function getTransactionTitle(type?: string | null, fallback?: string | null) {
  return fallback || humanizeLabel(type);
}
