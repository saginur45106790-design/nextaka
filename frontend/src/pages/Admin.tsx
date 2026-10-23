import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, Database, FileCheck2, FileText, Gauge, Layers3, LoaderCircle, LockKeyhole, Megaphone, MoreHorizontal, Network, Plus, RefreshCw, Search, Settings2, ShieldCheck, ShieldQuestion, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { api, money, date } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import '../admin.css';
import {downloadReport} from '../lib/export';

type RecordData = Record<string, unknown>;
type PageData = { items: RecordData[]; total: number; page: number; pageSize: number };
type Section = { id: string; bn: string; en: string; icon: LucideIcon; description: [string, string]; columns: string[] };
type InputKind = 'text' | 'textarea' | 'integer' | 'money' | 'datetime-local' | 'select' | 'checkbox' | 'json';
type InputField = { key: string; bn: string; en: string; type?: InputKind; required?: boolean; options?: string[]; hint?: string; initial?: string | boolean };
type AdminAction = { id: string; bn: string; en: string; path: string; method?: 'POST' | 'PATCH'; fields: InputField[]; description?: [string, string]; financial?: boolean; transform?: (data: RecordData) => RecordData };
type OpenAction = { action: AdminAction; record?: RecordData; key: string };
type PublicState = { mode: string; financialEnabled: boolean; blockers: string[] };

const sections: Section[] = [
  { id: 'overview', bn: 'সারসংক্ষেপ', en: 'Overview', icon: Gauge, description: ['প্ল্যাটফর্মের বাস্তব হিসাব ও কার্যক্রম এক নজরে।', 'A live view of platform records and financial operations.'], columns: [] },
  { id: 'users', bn: 'ব্যবহারকারী', en: 'Users', icon: Users, description: ['অ্যাকাউন্ট দেখুন এবং কারণসহ সাময়িক স্থগিত বা পুনরুদ্ধার করুন।', 'Review accounts and record the reason for suspending or restoring access.'], columns: ['fullName', 'email', 'status', 'role', 'createdAt'] },
  { id: 'verifications', bn: 'পরিচয় যাচাই', en: 'Verification', icon: ShieldCheck, description: ['ইমেইল ও বাস্তব provider দ্বারা যাচাইকৃত যোগাযোগের তথ্য।', 'Email verification and contact records verified by a real provider.'], columns: ['userId', 'kind', 'value', 'provider', 'verifiedAt'] },
  { id: 'plans', bn: 'মেশিন প্যাকেজ', en: 'Machine plans', icon: Layers3, description: ['লক্ষ্যমাত্রা ও operating arrangement নিয়ন্ত্রণ করুন। লক্ষ্যমাত্রা নিশ্চিত আয় নয়।', 'Manage targets and operating arrangements. Targets are not guaranteed income.'], columns: ['name', 'priceMinor', 'durationDays', 'dailyTargetMinor', 'totalTargetMinor', 'enabled'] },
  { id: 'contracts', bn: 'মাইনিং চুক্তি', en: 'Mining contracts', icon: FileCheck2, description: ['কেনার সময় সংরক্ষিত মূল্য, সময়সীমা এবং চুক্তির অবস্থা।', 'Purchase-time prices, operating periods and contract states.'], columns: ['id', 'userId', 'planId', 'priceMinor', 'status', 'endsAt'] },
  { id: 'revenues', bn: 'মাইনিং আয়', en: 'Mining revenue', icon: Activity, description: ['প্রকৃত আয়, independent verification এবং funded allocation পর্যালোচনা করুন।', 'Review actual revenue, independent verification and funded allocations.'], columns: ['reference', 'operationId', 'grossMinor', 'operatingCostMinor', 'netMinor', 'status'] },
  { id: 'deposits', bn: 'ডিপোজিট', en: 'Deposits', icon: ArrowDownLeft, description: ['শুধু independently confirmed settlement-এর ভিত্তিতে অনুমোদন দিন।', 'Approve only against independently confirmed payment settlement.'], columns: ['id', 'userId', 'provider', 'amountMinor', 'reference', 'status'] },
  { id: 'withdrawals', bn: 'উত্তোলন', en: 'Withdrawals', icon: ArrowUpRight, description: ['সংরক্ষিত অর্থের আবেদন ও প্রকৃত payment settlement পরিচালনা করুন।', 'Manage reserved-fund requests and actual payment settlement.'], columns: ['id', 'userId', 'provider', 'amountMinor', 'feeMinor', 'status'] },
  { id: 'referrals', bn: 'রেফারেল', en: 'Referrals', icon: Network, description: ['যাচাইকৃত qualifying deposit, fraud review ও marketing budget আবশ্যক।', 'Verified qualifying deposits, fraud review and a funded marketing budget are required.'], columns: ['id', 'referrerId', 'referredId', 'status', 'createdAt'] },
  { id: 'ledger', bn: 'ওয়ালেট ও লেজার', en: 'Wallet & ledger', icon: Wallet, description: ['অপরিবর্তনীয় লেজার। কোনো historical entry মুছে ফেলা বা সরাসরি balance পরিবর্তন করা যায় না।', 'Immutable ledger. Historical entries cannot be deleted and balances cannot be edited directly.'], columns: ['createdAt', 'accountId', 'kind', 'amountMinor', 'balanceAfter', 'referenceId'] },
  { id: 'reconciliation', bn: 'হিসাব মিলানো', en: 'Reconciliation', icon: ClipboardCheck, description: ['Wallet balance, ledger ও reserved funds-এর সামঞ্জস্য পরীক্ষা।', 'Check consistency between wallet balances, ledger entries and reserved funds.'], columns: ['id', 'status', 'findings', 'createdAt'] },
  { id: 'notifications', bn: 'নোটিফিকেশন', en: 'Notifications', icon: Bell, description: ['নির্দিষ্ট ব্যবহারকারীর জন্য in-app notification পাঠান।', 'Create in-app notifications for an identified user.'], columns: ['title', 'userId', 'message', 'readAt', 'createdAt'] },
  { id: 'content', bn: 'সাইট কনটেন্ট', en: 'Site content', icon: BookOpen, description: ['প্রকাশ্য যোগাযোগ এবং কনটেন্ট configuration।', 'Public contact details and content configuration.'], columns: ['key', 'value', 'updatedAt'] },
  { id: 'announcements', bn: 'ঘোষণা', en: 'Announcements', icon: Megaphone, description: ['সত্যনিষ্ঠ platform update তৈরি ও প্রকাশ করুন।', 'Create and publish truthful platform updates.'], columns: ['title', 'message', 'published', 'createdAt'] },
  { id: 'support', bn: 'সাপোর্ট টিকিট', en: 'Support tickets', icon: CircleHelp, description: ['ব্যবহারকারীর প্রশ্ন, account recovery ও appeal পর্যালোচনা করুন।', 'Review user questions, account recovery requests and appeals.'], columns: ['subject', 'userId', 'status', 'adminReply', 'createdAt'] },
  { id: 'risk', bn: 'ঝুঁকি পর্যবেক্ষণ', en: 'Risk & fraud', icon: ShieldQuestion, description: ['Risk signal পর্যালোচনা করুন। Shared IP নিজে অপরাধের প্রমাণ নয়।', 'Review risk signals. A shared IP is not proof of abuse.'], columns: ['type', 'userId', 'reason', 'status', 'reviewNote', 'createdAt'] },
  { id: 'audit', bn: 'অডিট লগ', en: 'Audit logs', icon: FileText, description: ['প্রশাসনিক পরিবর্তনের actor, timestamp ও ব্যাখ্যা।', 'Actors, timestamps and explanations for administrative changes.'], columns: ['createdAt', 'action', 'actorId', 'targetType', 'targetId'] },
  { id: 'settings', bn: 'সেটিংস', en: 'Settings', icon: Settings2, description: ['Campaign, payment instruction ও launch configuration। Server safety gates সবসময় প্রযোজ্য।', 'Campaign, payment instruction and launch configuration. Server safety gates always apply.'], columns: ['key', 'value', 'updatedAt'] },
  { id: 'security', bn: 'প্ল্যাটফর্ম নিরাপত্তা', en: 'Platform security', icon: LockKeyhole, description: ['বাস্তব security event এবং configured integration-এর অবস্থা।', 'Actual security events and configured integration status.'], columns: ['type', 'userId', 'metadata', 'createdAt'] },
  { id: 'backups', bn: 'ব্যাকআপ ও অপারেশন', en: 'Backups & operations', icon: Database, description: ['অবকাঠামোর সীমাবদ্ধতা, backup readiness এবং operational status।', 'Infrastructure limits, backup readiness and operational status.'], columns: ['status','automatedBackupsVerified','restoreDrillVerified','notes'] },
];
const extraSections: Section[] = [
  { id: 'operations', bn: 'মাইনিং অপারেশন', en: 'Mining operations', icon: Layers3, description: ['বাস্তব operating arrangement ও verification।', 'Actual operating arrangements and verification.'], columns: ['reference', 'providerReference', 'description', 'status', 'verifiedAt'] },
  { id: 'reserves', bn: 'পেআউট রিজার্ভ', en: 'Payout reserves', icon: Wallet, description: ['ব্যবহারকারীর deposit থেকে পৃথক, নথিভুক্ত funding।', 'Documented funding segregated from user deposits.'], columns: ['purpose', 'sourceReference', 'sourceType', 'fundedMinor', 'availableMinor', 'status'] },
];
const reason: InputField = { key: 'reason', bn: 'পর্যালোচনার কারণ (কমপক্ষে ১০ অক্ষর)', en: 'Review reason (at least 10 characters)', type: 'textarea', required: true };
const evidence: InputField = { key: 'evidence', bn: 'স্বাধীন যাচাইয়ের নথি / evidence reference', en: 'Independent verification evidence / reference', type: 'textarea', required: true, hint: 'Do not paste passwords, API keys or payment credentials.' };
const fields = {
  text: (key: string, bn: string, en: string, required = true): InputField => ({ key, bn, en, required }),
  money: (key: string, bn: string, en: string): InputField => ({ key, bn, en, type: 'money', required: true }),
  select: (key: string, bn: string, en: string, options: string[]): InputField => ({ key, bn, en, type: 'select', options, required: true }),
  time: (key: string, bn: string, en: string): InputField => ({ key, bn, en, type: 'datetime-local', required: true, hint: 'Asia/Dhaka · UTC+06:00' }),
};

// Action schemas mirror server-side validation. The server remains authoritative.
function actionsFor(section: string, record?: RecordData): AdminAction[] {
  const id = encodeURIComponent(String(record?.id ?? ''));
  switch (section) {
    case 'contracts': return record ? [{id:'contract-review',bn:'চুক্তি পর্যালোচনা',en:'Review contract',path:`/admin/contracts/${id}/review`,financial:true,fields:[fields.select('action','করণীয়','Action',['PAUSE','RESUME','REFUND']),reason],description:['Refund শুধু unallocated contract-এর জন্য। আগের ledger মুছে যাবে না।','Refunds are limited to unallocated contracts. Original ledger entries remain.']}] : [];
    case 'users': return record ? [{ id: 'user-status', bn: 'অ্যাকাউন্ট পর্যালোচনা', en: 'Review account', path: `/admin/users/${id}/status`, fields: [fields.select('status', 'অ্যাকাউন্টের অবস্থা', 'Account status', ['ACTIVE', 'SUSPENDED', 'LOCKED']), reason] }, { id: 'promotion-award', bn: 'Promotional credit পর্যালোচনা', en: 'Review promotional award', path: `/admin/promotions/${id}`, financial: true, fields: [fields.text('reserveId', 'Verified promotion reserve ID', 'Verified promotion reserve ID'), reason], description: ['একবারের non-withdrawable promotional credit। Verified user, fraud review ও পৃথক promotion budget আবশ্যক।', 'One-time non-withdrawable promotional credit. Requires a verified user, fraud review and a separate promotion budget.'] }] : [];
    case 'plans': return record ? [{ id: 'plan-update', bn: 'প্যাকেজ সম্পাদনা', en: 'Edit plan', path: `/admin/plans/${id}`, method: 'PATCH', fields: [fields.text('name', 'প্যাকেজের নাম', 'Plan name'), fields.money('priceMinor', 'ক্রয়মূল্য (৳)', 'Purchase price (৳)'), { key: 'durationDays', bn: 'সময়কাল (দিন)', en: 'Duration (days)', type: 'integer', required: true }, fields.money('dailyTargetMinor', 'দৈনিক লক্ষ্যমাত্রা (৳)', 'Daily target (৳)'), fields.money('totalTargetMinor', 'সর্বমোট লক্ষ্যমাত্রা (৳)', 'Total target (৳)'), fields.text('operationId', 'Verified operation ID', 'Verified operation ID', false), { key: 'enabled', bn: 'প্যাকেজ সক্রিয়', en: 'Plan enabled', type: 'checkbox' }, reason], description: ['সর্বমোট লক্ষ্যমাত্রার মধ্যে ক্রয়মূল্য অন্তর্ভুক্ত। বিদ্যমান চুক্তির snapshot পরিবর্তন হবে না।', 'Total target includes the purchase amount. Existing contract snapshots remain unchanged.'] }] : [];
    case 'announcements': return record ? [{ id: 'announcement-update', bn: 'ঘোষণা সম্পাদনা', en: 'Edit announcement', path: `/admin/announcements/${id}`, method: 'PATCH', fields: [fields.text('title', 'শিরোনাম', 'Title'), { key: 'message', bn: 'বার্তা', en: 'Message', type: 'textarea', required: true }, { key: 'published', bn: 'প্রকাশ করুন', en: 'Publish', type: 'checkbox' }, reason] }] : [{ id: 'announcement', bn: 'নতুন ঘোষণা', en: 'New announcement', path: '/admin/announcements', fields: [fields.text('title', 'শিরোনাম', 'Title'), { key: 'message', bn: 'বার্তা', en: 'Message', type: 'textarea', required: true }, { key: 'published', bn: 'প্রকাশ করুন', en: 'Publish', type: 'checkbox' }] }];
    case 'notifications': return [{ id: 'notification', bn: 'নোটিফিকেশন তৈরি', en: 'Create notification', path: '/admin/notifications', fields: [fields.text('userId', 'ব্যবহারকারীর ID', 'User ID'), fields.text('title', 'শিরোনাম', 'Title'), { key: 'message', bn: 'বার্তা', en: 'Message', type: 'textarea', required: true }] }];
    case 'support': return record ? [{ id: 'support-reply', bn: 'উত্তর ও অবস্থা', en: 'Reply & status', path: `/admin/support/${id}`, method: 'PATCH', fields: [fields.select('status', 'টিকিটের অবস্থা', 'Ticket status', ['OPEN', 'IN_PROGRESS', 'CLOSED']), { key: 'adminReply', bn: 'ব্যবহারকারীর জন্য উত্তর', en: 'Reply to user', type: 'textarea', required: true }] }] : [];
    case 'risk': return record ? [{ id: 'risk-review', bn: 'Risk review', en: 'Review signal', path: `/admin/risk/${id}/review`, fields: [fields.select('status', 'পর্যালোচনার অবস্থা', 'Review status', ['RESOLVED', 'DISMISSED']), reason] }] : [];
    case 'settings':
    case 'content': return [{ id: 'settings-update', bn: 'Configuration পরিবর্তন', en: 'Update configuration', path: '/admin/settings', method: 'PATCH', fields: [fields.select('key', 'Configuration key', 'Configuration key', ['platform', 'payments', 'promotion', 'referral', 'withdrawal', 'content']), { key: 'value', bn: 'Configuration value (JSON)', en: 'Configuration value (JSON)', type: 'json', required: true, initial: '{}', hint: 'Only server-allowlisted settings are accepted. Never paste secrets.' }, reason] }];
    case 'operations': return record ? String(record.status) === 'PENDING' ? [{ id: 'operation-verify', bn: 'Operating arrangement যাচাই', en: 'Verify operating arrangement', path: `/admin/operations/${id}/verify`, financial: true, fields: [evidence], description: ['রেকর্ডের creator ছাড়া অন্য administrator-কে independently যাচাই করতে হবে।', 'An administrator other than the record creator must independently verify this arrangement.'] }] : [] : [{ id: 'operation-create', bn: 'অপারেশন নথিভুক্ত', en: 'Document operation', path: '/admin/operations', fields: [fields.text('reference', 'অপারেশন reference', 'Operation reference'), fields.text('providerReference', 'Mining provider / pool reference', 'Mining provider / pool reference'), { key: 'description', bn: 'প্রকৃত operating model', en: 'Actual operating model', type: 'textarea', required: true }, { key: 'arrangementEvidence', bn: 'Lawful arrangement-এর evidence', en: 'Lawful arrangement evidence', type: 'textarea', required: true }], description: ['শুধু বাস্তব, নথিভুক্ত mining operation যোগ করুন। সংরক্ষণ করলেই verified হবে না।', 'Add only a real, documented mining operation. Saving does not verify it.'] }];
    case 'reserves': return record ? String(record.status) === 'PENDING' ? [{ id: 'reserve-verify', bn: 'Funding যাচাই', en: 'Verify reserve funding', path: `/admin/reserves/${id}/verify`, financial: true, fields: [evidence], description: ['আলাদা administrator-কে স্বাধীন funding source ও বাস্তব fund availability যাচাই করতে হবে।', 'A separate administrator must verify the independent funding source and actual fund availability.'] }] : [] : [{ id: 'reserve-create', bn: 'Funding নথিভুক্ত', en: 'Document funding', path: '/admin/reserves', fields: [fields.select('purpose', 'রিজার্ভের উদ্দেশ্য', 'Reserve purpose', ['MINING', 'REFERRAL', 'PROMOTION']), fields.select('sourceType', 'বৈধ অর্থের উৎস', 'Legitimate funding source', ['MINING_PROCEEDS', 'OWNER_CAPITAL', 'EARNED_FEES']), fields.text('sourceReference', 'Unique source reference', 'Unique source reference'), fields.money('amountMinor', 'প্রকৃত funded amount (৳)', 'Actual funded amount (৳)'), evidence], description: ['নতুন ব্যবহারকারীর deposit payout reserve নয়। এই রেকর্ড পৃথক administrator দ্বারা যাচাই করতে হবে।', 'New user deposits are not payout reserves. This record requires verification by a separate administrator.'] }];
    case 'revenues': return record ? String(record.status) === 'PENDING' ? [{ id: 'revenue-verify', bn: 'প্রকৃত আয় যাচাই', en: 'Verify actual revenue', path: `/admin/revenues/${id}/verify`, financial: true, fields: [fields.text('statementReference', 'স্বাধীন statement reference', 'Independent statement reference'), evidence], description: ['Creator ছাড়া অন্য administrator স্বাধীন নথি দিয়ে revenue যাচাই করবেন।', 'An administrator other than the creator must verify revenue using independent evidence.'] }] : [] : [
      { id: 'revenue-create', bn: 'আয় নথিভুক্ত', en: 'Record revenue', path: '/admin/revenues', fields: [fields.text('operationId', 'Verified operation ID', 'Verified operation ID'), fields.text('reference', 'Unique revenue reference', 'Unique revenue reference'), fields.money('grossMinor', 'প্রকৃত মোট আয় (৳)', 'Actual gross revenue (৳)'), fields.money('operatingCostMinor', 'Operating cost (৳)', 'Operating cost (৳)'), fields.time('periodStartsAt', 'Revenue period শুরু', 'Revenue period start'), fields.time('periodEndsAt', 'Revenue period শেষ', 'Revenue period end'), evidence], description: ['এই form mining provider থেকে অর্থ সংগ্রহ করে না। প্রকৃত statement ও independent review আবশ্যক।', 'This form does not collect money from a mining provider. Actual statements and independent review are required.'] },
      { id: 'allocation-create', bn: 'Funded allocation', en: 'Funded allocation', path: '/admin/allocations', financial: true, fields: [fields.text('contractId', 'চুক্তির ID', 'Contract ID'), fields.text('revenueId', 'Verified revenue ID', 'Verified revenue ID'), fields.text('reserveId', 'Verified mining reserve ID', 'Verified mining reserve ID'), { key: 'period', bn: '২৪ ঘণ্টার period number (১ থেকে)', en: '24-hour period number (starting at 1)', type: 'integer', required: true }, fields.money('amountMinor', 'অনুমোদিত allocation (৳)', 'Authorized allocation (৳)')], description: ['Revenue ও reserve দুটোই sufficient হতে হবে। Allocation সঙ্গে সঙ্গে withdrawable credit নয়।', 'Both revenue and reserve must be sufficient. An allocation is not an immediate withdrawable credit.'] },
      { id: 'settlements-run', bn: 'Settlement চালান', en: 'Run settlement', path: '/admin/settlements/run', financial: true, fields: [], description: ['শুধু eligible, verified ও funded allocation settle হবে। Timer বা target থেকে অর্থ তৈরি হবে না।', 'Only eligible, verified and funded allocations settle. Timers and targets never generate money.'] },
    ];
    case 'deposits': return record && ['PENDING', 'UNDER_REVIEW'].includes(String(record.status)) ? [
      { id: 'deposit-verify', bn: 'Provider settlement যাচাই', en: 'Verify provider settlement', path: `/admin/deposits/${id}/verify`, financial: true, fields: [fields.text('settlementReference', 'Provider settlement reference', 'Provider settlement reference'), fields.money('amountMinor', 'Independently confirmed amount (৳)', 'Independently confirmed amount (৳)'), fields.time('providerConfirmedAt', 'Provider confirmation সময়', 'Provider confirmation time'), evidence], description: ['Screenshot বা submitted reference যথেষ্ট নয়। স্বাধীন provider record / settled statement যাচাই করুন।', 'A screenshot or submitted reference is insufficient. Verify independent provider records or a settled statement.'] },
      { id: 'deposit-review', bn: 'ডিপোজিট review', en: 'Review deposit', path: `/admin/deposits/${id}/review`, financial: true, fields: [fields.select('action', 'Review action', 'Review action', ['REVIEW', 'APPROVE', 'REJECT']), reason], description: ['অনুমোদনের আগে verified payment record এবং verifier থেকে ভিন্ন administrator আবশ্যক।', 'Approval requires a verified payment record and an administrator different from its verifier.'] },
    ] : [];
    case 'withdrawals': return record && !['PAID', 'REJECTED', 'CANCELLED'].includes(String(record.status)) ? [
      { id: 'withdrawal-review', bn: 'উত্তোলন review', en: 'Review withdrawal', path: `/admin/withdrawals/${id}/review`, financial: true, fields: [fields.select('action', 'Review action', 'Review action', ['REVIEW', 'APPROVE', 'PROCESS', 'REJECT']), reason], description: ['প্রতিটি status transition backend-এ যাচাই হয়। Rejection হলে held funds মুক্ত হবে।', 'The backend validates every status transition. Rejection releases held funds.'] },
      ...(String(record.status) === 'PROCESSING' ? [{ id: 'withdrawal-paid', bn: 'প্রকৃত settlement নথিভুক্ত', en: 'Record actual settlement', path: `/admin/withdrawals/${id}/review`, financial: true, fields: [fields.text('settlementReference', 'Payment provider settlement reference', 'Payment provider settlement reference'), fields.time('settledAt', 'প্রকৃত settlement সময়', 'Actual settlement time'), evidence, reason], transform: (data: RecordData) => ({ ...data, action: 'PAID' }), description: ['সত্যিকারের payment settlement নিশ্চিত হলে এবং approver থেকে ভিন্ন administrator হলে তবেই completed হবে।', 'Completion requires confirmed real payment settlement and an administrator different from the approver.'] as [string, string] }] : []),
    ] : [];
    case 'referrals': return record && String(record.status) !== 'APPROVED' && String(record.status) !== 'REJECTED' ? [
      { id: 'referral-approve', bn: 'Commission অনুমোদন', en: 'Approve commission', path: `/admin/referrals/${id}/review`, financial: true, fields: [fields.text('reserveId', 'Verified referral reserve ID', 'Verified referral reserve ID'), fields.text('qualifyingDepositId', 'Verified qualifying deposit ID', 'Verified qualifying deposit ID'), reason], transform: (data) => ({ ...data, action: 'APPROVE' }), description: ['Fraud review, বাস্তব qualifying deposit ও independent marketing budget ছাড়া commission হবে না।', 'Commission requires fraud review, a real qualifying deposit and an independent marketing budget.'] },
      { id: 'referral-reject', bn: 'রেফারেল বাতিল', en: 'Reject referral', path: `/admin/referrals/${id}/review`, fields: [reason], transform: (data) => ({ ...data, action: 'REJECT' }) },
    ] : [];
    case 'reconciliation': return [{ id: 'reconcile', bn: 'হিসাব মিলিয়ে দেখুন', en: 'Run reconciliation', path: '/admin/reconciliation', fields: [], description: ['এটি authoritative ledger ও wallet-এর হিসাব পরীক্ষা করে একটি স্থায়ী report সংরক্ষণ করবে।', 'This checks authoritative ledger and wallet records and stores a reconciliation report.'] }];
    default: return [];
  }
}

function recordValue(record: RecordData, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as RecordData)[part] : undefined, record);
}
function humanize(key: string): string {
  return key.replace(/Minor$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase());
}
function plainValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function isRecord(value: unknown): value is RecordData { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function moneyInput(value: unknown): string {
  try { const amount = BigInt(String(value ?? 0)); return `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`; } catch { return ''; }
}
function parseMoney(value: string): string {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a non-negative BDT amount with at most two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
}
const privateField = /password|tokenHash|csrfHash|secret|ipHash/i;
function safeRecord(value: RecordData): RecordData {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateField.test(key)).map(([key, item]) => [key, isRecord(item) ? safeRecord(item) : Array.isArray(item) ? item.map((entry: unknown) => isRecord(entry) ? safeRecord(entry) : entry) : item]));
}
function Cell({ value, field }: { value: unknown; field: string }): ReactNode {
  if (value === undefined || value === null) return <span className="admin-dim">—</span>;
  if (field.endsWith('Minor') || field === 'balanceAfter') return <span className="admin-amount">{money(String(value))}</span>;
  if (field.endsWith('At') && typeof value === 'string') return <span className="admin-date">{date(value)}</span>;
  if (typeof value === 'boolean') return <span className={`admin-status ${value ? 'is-positive' : ''}`}>{value ? 'Enabled' : 'Disabled'}</span>;
  if (field === 'status' || field === 'role') return <span className={`admin-status ${['ACTIVE', 'VERIFIED', 'APPROVED', 'PAID', 'COMPLETED', 'RESOLVED', 'PASS'].includes(String(value)) ? 'is-positive' : ['REJECTED', 'SUSPENDED', 'FAIL', 'CANCELLED'].includes(String(value)) ? 'is-negative' : ''}`}>{plainValue(value).replaceAll('_', ' ')}</span>;
  if (isRecord(value) || Array.isArray(value)) return <span className="admin-structured">{Object.keys(value).length} fields</span>;
  if (field === 'id' || field.endsWith('Id')) return <span className="admin-id" title={String(value)}>{String(value).slice(0, 8)}…</span>;
  return <span className="admin-cell-text" title={String(value)}>{plainValue(value)}</span>;
}

function ActionDialog({ item, onClose, onSuccess }: { item: OpenAction; onClose: () => void; onSuccess: () => void }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => Object.fromEntries(item.action.fields.map((field) => {
    const current = item.record?.[field.key] ?? field.initial;
    const initial = field.type === 'checkbox' ? Boolean(current) : field.type === 'money' && current !== undefined ? moneyInput(current) : field.type === 'json' && typeof current !== 'string' ? JSON.stringify(current ?? {}, null, 2) : String(current ?? '');
    return [field.key, initial];
  })));
  useEffect(() => { ref.current?.showModal(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setPending(true);
    try {
      const payload: RecordData = {};
      for (const field of item.action.fields) {
        const value = values[field.key];
        if (field.type === 'checkbox') payload[field.key] = Boolean(value);
        else if (!field.required && String(value ?? '').trim() === '') continue;
        else if (field.type === 'money') payload[field.key] = parseMoney(String(value));
        else if (field.type === 'integer') {
          const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw new Error('Enter a valid non-negative whole number.'); payload[field.key] = number;
        } else if (field.type === 'json') payload[field.key] = JSON.parse(String(value));
        else if (field.type === 'datetime-local') payload[field.key] = new Date(`${String(value)}+06:00`).toISOString();
        else payload[field.key] = String(value ?? '').trim();
      }
      await api(item.action.path, { method: item.action.method ?? 'POST', headers: { 'Idempotency-Key': item.key }, body: JSON.stringify(item.action.transform ? item.action.transform(payload) : payload) });
      onSuccess(); onClose();
    } catch (problem) { setError(problem instanceof Error ? problem.message : t('পরিবর্তন সংরক্ষণ করা যায়নি।', 'Could not save this change.')); }
    finally { setPending(false); }
  }
  return <dialog ref={ref} className="admin-dialog" onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }} onClose={onClose} aria-labelledby="admin-action-title">
    <form onSubmit={submit}>
      <div className="admin-dialog-heading"><div><span className="admin-eyebrow">NEXTAKA / ADMIN</span><h2 id="admin-action-title">{t(item.action.bn, item.action.en)}</h2></div><button type="button" className="admin-icon-button" aria-label={t('বন্ধ করুন', 'Close')} disabled={pending} onClick={onClose}><X size={20} /></button></div>
      {item.action.description && <p className="admin-description">{t(...item.action.description)}</p>}
      {item.record?.id ? <div className="admin-record-id">Record: {String(item.record.id)}</div> : null}
      <div className="admin-form-fields">{item.action.fields.map((field) => <label className={field.type === 'checkbox' ? 'admin-checkbox' : 'field'} key={field.key}>
        {field.type === 'checkbox' ? <><input type="checkbox" checked={Boolean(values[field.key])} onChange={(event) => setValues({ ...values, [field.key]: event.target.checked })} /><span>{t(field.bn, field.en)}</span></> : <>
          <span>{t(field.bn, field.en)}{field.required ? ' *' : ''}</span>
          {field.type === 'textarea' || field.type === 'json' ? <textarea rows={field.type === 'json' ? 6 : 3} value={String(values[field.key])} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} required={field.required} maxLength={field.type === 'json' ? 12000 : 4000} spellCheck={field.type !== 'json'} /> : field.type === 'select' ? <select value={String(values[field.key])} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} required={field.required}><option value="">{t('বেছে নিন', 'Select an option')}</option>{field.options?.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select> : <input type={field.type === 'integer' ? 'number' : field.type === 'datetime-local' ? 'datetime-local' : 'text'} inputMode={field.type === 'money' ? 'decimal' : field.type === 'integer' ? 'numeric' : undefined} min={field.type === 'integer' ? 0 : undefined} step={field.type === 'integer' ? 1 : undefined} value={String(values[field.key])} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} required={field.required} maxLength={500} />}
          {field.hint && <small className="admin-dim">{field.hint}</small>}
        </>}
      </label>)}</div>
      {item.action.financial && <label className="admin-checkbox admin-confirmation"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{t('আমি স্বাধীন উৎসের নথি যাচাই করেছি। এই পরিবর্তন audit log-এ সংরক্ষিত হবে।', 'I reviewed the independent source evidence. This action will be recorded in the audit log.')}</span></label>}
      {error && <p role="alert" className="admin-error">{error}</p>}
      <footer className="admin-dialog-footer"><button type="button" className="button secondary" onClick={onClose} disabled={pending}>{t('বাতিল', 'Cancel')}</button><button type="submit" className="button" disabled={pending || (item.action.financial && !confirmed)}>{pending ? <LoaderCircle size={17} className="admin-spin" /> : <Check size={17} />}{t('নিশ্চিত ও সংরক্ষণ', 'Confirm & save')}</button></footer>
    </form>
  </dialog>;
}

function DetailDialog({ record, section, onClose, onAction }: { record: RecordData; section: string; onClose: () => void; onAction: (action: AdminAction, record: RecordData) => void }) {
  const { t } = useLanguage(); const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const actions = actionsFor(section, record);
  return <dialog ref={ref} className="admin-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="admin-detail-title"><div className="admin-dialog-heading"><div><span className="admin-eyebrow">AUDITABLE RECORD</span><h2 id="admin-detail-title">{t('রেকর্ডের বিস্তারিত', 'Record details')}</h2></div><button className="admin-icon-button" onClick={onClose} aria-label={t('বন্ধ করুন', 'Close')}><X size={20} /></button></div><dl className="admin-detail-list">{Object.entries(safeRecord(record)).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{isRecord(value) || Array.isArray(value) ? <pre>{JSON.stringify(value, null, 2)}</pre> : key.endsWith('Minor') || key === 'balanceAfter' ? money(String(value ?? '0')) : key.endsWith('At') && typeof value === 'string' ? date(value) : plainValue(value)}</dd></div>)}</dl>{actions.length > 0 && <footer className="admin-dialog-footer">{actions.map((action) => <button key={action.id} className="button" onClick={() => { onClose(); onAction(action, record); }}>{t(action.bn, action.en)}</button>)}</footer>}</dialog>;
}

function Overview({ data, loading, onNavigate }: { data: RecordData | undefined; loading: boolean; onNavigate: (section: string) => void }) {
  const { t } = useLanguage();
  const metrics = [
    ['registeredUsers', 'নিবন্ধিত ব্যবহারকারী', 'Registered users', Users, false],
    ['verifiedUsers', 'যাচাইকৃত ব্যবহারকারী', 'Verified users', ShieldCheck, false],
    ['activeMachines', 'সক্রিয় মেশিন', 'Active machines', Layers3, false],
    ['pendingDeposits', 'অপেক্ষমাণ ডিপোজিট', 'Pending deposits', ArrowDownLeft, false],
    ['approvedDepositsMinor', 'অনুমোদিত ডিপোজিট', 'Approved deposits', ArrowDownLeft, true],
    ['pendingWithdrawals', 'অপেক্ষমাণ উত্তোলন', 'Pending withdrawals', ArrowUpRight, false],
    ['paidWithdrawalsMinor', 'সম্পন্ন উত্তোলন', 'Paid withdrawals', ArrowUpRight, true],
    ['verifiedMiningRevenueMinor', 'যাচাইকৃত মাইনিং আয়', 'Verified mining revenue', Activity, true],
    ['withdrawableLiabilitiesMinor', 'উত্তোলনযোগ্য দায়', 'Withdrawable liabilities', Wallet, true],
    ['pendingCommissions', 'অপেক্ষমাণ কমিশন', 'Pending commissions', Network, false],
    ['availableReservesMinor', 'উপলব্ধ রিজার্ভ', 'Available settlement reserves', Database, true],
  ] as const;
  return <>
    <div className="admin-metrics">{metrics.map(([key, bn, en, Icon, isMoney]) => <article className="admin-metric" key={key}><div className="admin-metric-icon"><Icon size={18} /></div><span>{t(bn, en)}</span><strong>{loading ? <span className="admin-skeleton" /> : data?.[key] === undefined ? '—' : isMoney ? money(String(data[key])) : plainValue(data[key])}</strong><small>{t('ডেটাবেস থেকে', 'From database')}</small></article>)}</div>
    <div className="admin-overview-bottom"><article className="admin-process-card"><div className="admin-card-top"><ShieldCheck size={22} /><span className="admin-eyebrow">FINANCIAL CONTROLS</span></div><h3>{t('যাচাই আগে, settlement পরে।', 'Verify first. Settle with evidence.')}</h3><p>{t('প্রকৃত revenue, independently verified reserve এবং approved allocation ছাড়া reward তৈরি হয় না।', 'Rewards require actual revenue, an independently verified reserve and an approved allocation.')}</p><div className="admin-process-steps"><span>01 · Revenue</span><span>02 · Verification</span><span>03 · Funded allocation</span><span>04 · Settlement</span></div><button className="button secondary" onClick={() => onNavigate('revenues')}>{t('আয় যাচাই দেখুন', 'Review mining revenue')}<ArrowUpRight size={17} /></button></article><article className="admin-process-card"><div className="admin-card-top"><ClipboardCheck size={22} /><span className="admin-eyebrow">OPERATIONS QUEUE</span></div><h3>{t('পরবর্তী পর্যালোচনা', 'Next reviews')}</h3><div className="admin-quick-links">{[['deposits', 'ডিপোজিট যাচাই', 'Verify deposits'], ['withdrawals', 'উত্তোলন পর্যালোচনা', 'Review withdrawals'], ['risk', 'Risk signal পর্যালোচনা', 'Review risk signals'], ['reconciliation', 'লেজার হিসাব মেলানো', 'Reconcile ledger']].map(([id, bn, en]) => <button key={id} onClick={() => onNavigate(id)}>{t(bn, en)}<ChevronRight size={18} /></button>)}</div></article></div>
    {data && Object.keys(data).some((key) => /daily|monthly|reconciliation|revenueVersus/i.test(key)) && <article className="admin-process-card admin-period-summary"><h3>{t('ব্যাকএন্ডের আর্থিক সারসংক্ষেপ', 'Backend financial summaries')}</h3>{Object.entries(data).filter(([key]) => /daily|monthly|reconciliation|revenueVersus/i.test(key)).map(([key, value]) => <div key={key}><h4>{humanize(key)}</h4><pre>{JSON.stringify(value, null, 2)}</pre></div>)}</article>}
  </>;
}

export default function Admin() {
  const { t } = useLanguage(); const { user } = useAuth(); const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams(); const sectionId = params.get('section') ?? 'overview';
  const section = [...sections, ...extraSections].find((item) => item.id === sectionId) ?? sections[0];
  const [search, setSearch] = useState(''); const [debouncedSearch, setDebouncedSearch] = useState(''); const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<OpenAction | null>(null); const [detail, setDetail] = useState<RecordData | null>(null); const [notice, setNotice] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 7000); return () => clearTimeout(timer); }, [notice]);
  const allowed = user?.role === 'ADMIN';
  const config = useQuery({ queryKey: ['public', 'config'], queryFn: () => api<PublicState>('/public/config'), enabled: allowed, staleTime: 30000 });
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api<RecordData>('/admin/overview'), enabled: allowed && section.id === 'overview', staleTime: 15000 });
  const records = useQuery({ queryKey: ['admin', section.id, page, debouncedSearch], queryFn: () => api<PageData | RecordData>(`/admin/${section.id}?page=${page}&pageSize=20&search=${encodeURIComponent(debouncedSearch)}`), enabled: allowed && section.id !== 'overview', staleTime: 10000 });
  const isPageData = records.data && Array.isArray(records.data.items);
  const list = isPageData ? records.data as PageData : undefined;
  const data = list?.items ?? [];
  const error = section.id === 'overview' ? overview.error : records.error;
  const loading = section.id === 'overview' ? overview.isLoading : records.isLoading;
  function navigate(id: string) { setParams({ section: id }); setPage(1); setSearch(''); setDebouncedSearch(''); setDetail(null); }
  function open(action: AdminAction, record?: RecordData) { setOpened({ action, record, key: crypto.randomUUID() }); }
  function success() { void queryClient.invalidateQueries({ queryKey: ['admin'] }); void queryClient.invalidateQueries({ queryKey: ['public'] }); void queryClient.invalidateQueries({ queryKey: ['config'] }); setNotice(t('পরিবর্তন সংরক্ষিত হয়েছে।', 'The change was saved.')); }
  async function refresh() { await queryClient.invalidateQueries({ queryKey: ['admin'] }); await config.refetch(); }
  if (!allowed) return <div className="admin-access-denied glass"><LockKeyhole size={32} /><h1>{t('প্রশাসনিক অনুমতি প্রয়োজন', 'Administrator access required')}</h1><p>{t('এই অংশটি অনুমোদিত প্রশাসকের জন্য সংরক্ষিত।', 'This area is restricted to authorized administrators.')}</p></div>;
  const Icon = section.icon;
  return <div className="admin-console">
    <header className="admin-console-heading"><div><span className="admin-eyebrow"><ShieldCheck size={14} /> NEXTAKA CONTROL CENTER</span><h1>{t('প্রশাসন', 'Administration')}<span className="admin-access-pill">{t('সুরক্ষিত', 'Restricted')}</span></h1><p>{t('স্বচ্ছ হিসাব। দায়িত্বশীল পরিচালনা।', 'Transparent accounting. Responsible operations.')}</p></div><button className="admin-icon-button" onClick={() => void refresh()} aria-label={t('তথ্য রিফ্রেশ', 'Refresh data')}><RefreshCw size={19} className={records.isFetching || overview.isFetching ? 'admin-spin' : ''} /></button></header>
    <div className={`admin-launch-banner ${config.data?.financialEnabled ? 'is-live' : ''}`}><ShieldCheck size={20} /><div><strong>{config.data?.financialEnabled ? t('আর্থিক কার্যক্রম সক্রিয়', 'Financial operations enabled') : t('প্রি-লঞ্চ সুরক্ষা সক্রিয়', 'Pre-launch protection active')}</strong><p>{config.data ? config.data.financialEnabled ? t('সব financial action server-side controls ও funding verification-এর অধীন।', 'All financial actions remain subject to server controls and funding verification.') : (config.data.blockers?.join(' · ') || t('আর্থিক কার্যক্রম বন্ধ রয়েছে।', 'Financial activity is disabled.')) : t('সিস্টেম configuration যাচাই হচ্ছে।', 'Checking system configuration.')}</p></div><span>{config.data?.mode ?? 'CHECKING'}</span></div>
    {notice && <div className="admin-toast" role="status"><Check size={18} />{notice}<button className="admin-icon-button" onClick={() => setNotice('')} aria-label={t('বন্ধ করুন', 'Dismiss')}><X size={16} /></button></div>}
    <div className="admin-workspace"><nav className="admin-section-nav" aria-label={t('প্রশাসনিক বিভাগ', 'Administration sections')}>{sections.map((item) => <button key={item.id} className={section.id === item.id || (item.id === 'revenues' && extraSections.some((extra) => extra.id === section.id)) ? 'is-active' : ''} onClick={() => navigate(item.id)} aria-current={section.id === item.id ? 'page' : undefined}><item.icon size={17} /><span>{t(item.bn, item.en)}</span>{section.id === item.id && <span className="admin-nav-dot" />}</button>)}</nav>
      <main className="admin-section"><div className="admin-section-heading"><div><div className="admin-section-title"><Icon size={23} /><h2>{t(section.bn, section.en)}</h2></div><p>{t(...section.description)}</p></div><div className="admin-section-actions">{actionsFor(section.id).map((action) => <button className="button" key={action.id} onClick={() => open(action)}><Plus size={16} />{t(action.bn, action.en)}</button>)}</div></div>
        {['revenues', 'operations', 'reserves'].includes(section.id) && <div className="admin-tabs">{[{ id: 'revenues', bn: 'আয়', en: 'Revenue' }, ...extraSections].map((item) => <button key={item.id} className={section.id === item.id ? 'is-active' : ''} onClick={() => navigate(item.id)}>{t(item.bn, item.en)}</button>)}</div>}
        {error && <div className="admin-error" role="alert"><ShieldQuestion size={20} /><div><strong>{t('তথ্য আনা যায়নি', 'Could not load records')}</strong><p>{error instanceof Error ? error.message : t('আবার চেষ্টা করুন।', 'Please try again.')}</p><button className="button secondary" onClick={() => void refresh()}>{t('আবার চেষ্টা', 'Retry')}</button></div></div>}
        {section.id === 'overview' ? <Overview data={overview.data} loading={loading} onNavigate={navigate} /> : <>
          <div className="admin-table-tools"><label className="admin-search"><Search size={17} /><input disabled={section.id!=='users'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('রেকর্ড খুঁজুন…', 'Search records…')} aria-label={t('রেকর্ড অনুসন্ধান', 'Search records')} /></label>{list&&<button className="button secondary" disabled={!data.length} onClick={()=>downloadReport(section.id,data)}>{t('এই পৃষ্ঠা export','Export this page')}</button>}{list && <span className="admin-dim">{list.total} {t('টি রেকর্ড', 'records')}</span>}</div>
          {loading ? <div className="admin-table-loading" aria-label={t('তথ্য আসছে', 'Loading records')}>{[1, 2, 3, 4, 5].map((number) => <div key={number} className="admin-skeleton" />)}</div> : !error && list ? data.length === 0 ? <div className="admin-empty"><Icon size={34} /><h3>{t('এখনো কোনো রেকর্ড নেই', 'No records yet')}</h3><p>{t('সংশ্লিষ্ট কার্যক্রম সম্পন্ন হলে আসল ডেটা এখানে দেখা যাবে।', 'Actual records will appear here when the corresponding activity occurs.')}</p></div> : <>
            <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{section.columns.map((column) => <th key={column}>{humanize(column)}</th>)}<th><span className="admin-sr-only">{t('বিস্তারিত', 'Details')}</span></th></tr></thead><tbody>{data.map((record, index) => <tr key={String(record.id ?? record.key ?? index)}>{section.columns.map((column) => <td key={column}><Cell value={recordValue(record, column)} field={column} /></td>)}<td><button className="admin-icon-button" onClick={() => setDetail(record)} aria-label={t('রেকর্ড খুলুন', 'Open record')}><MoreHorizontal size={20} /></button></td></tr>)}</tbody></table></div>
            <footer className="admin-pagination"><span>{t('পৃষ্ঠা', 'Page')} {page} / {Math.max(1, Math.ceil(list.total / list.pageSize))}</span><div><button className="admin-icon-button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t('আগের পৃষ্ঠা', 'Previous page')}><ChevronLeft size={18} /></button><button className="admin-icon-button" disabled={page * list.pageSize >= list.total} onClick={() => setPage(page + 1)} aria-label={t('পরের পৃষ্ঠা', 'Next page')}><ChevronRight size={18} /></button></div></footer>
          </> : !error && records.data ? <article className="admin-process-card"><dl className="admin-detail-list">{Object.entries(safeRecord(records.data)).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{isRecord(value) || Array.isArray(value) ? <pre>{JSON.stringify(value, null, 2)}</pre> : plainValue(value)}</dd></div>)}</dl></article> : null}
          {section.id === 'backups' && <div className="admin-policy-note"><Database size={21} /><p>{t('Render Free PostgreSQL ৩০ দিনে expire হয় এবং managed backup দেয় না। Free web service idle হলে sleep করে। পরীক্ষিত restore, durable database এবং production infrastructure ছাড়া real-money operations চালু করবেন না।', 'Render Free PostgreSQL expires after 30 days and has no managed backups. Free web services sleep when idle. Real-money operations require tested restore procedures, a durable database and production infrastructure.')}</p></div>}
          {section.id === 'verifications' && <div className="admin-policy-note"><ShieldCheck size={21} /><p>{t('Phone OTP provider সংযুক্ত না থাকলে ফোন নম্বরকে verified দেখানো যাবে না। ইমেইল যাচাই verification link-এর মাধ্যমে সম্পন্ন হয়।', 'A phone number cannot be marked verified without a configured phone OTP provider. Email verification uses a verification link.')}</p></div>}
        </>}
      </main>
    </div>
    {opened && <ActionDialog key={opened.key} item={opened} onClose={() => setOpened(null)} onSuccess={success} />}
    {detail && <DetailDialog record={detail} section={section.id} onClose={() => setDetail(null)} onAction={open} />}
  </div>;
}
