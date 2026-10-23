/** Approved provider adapters must independently check provider records.
 * The manual workflow deliberately has no synthetic success implementation. */
export type PaymentProvider = 'BKASH' | 'NAGAD';
export interface VerifiedProviderPayment {
 provider:PaymentProvider;
 reference:string;
 amountMinor:bigint;
 settledAt:Date;
 verifiedEvidenceReference:string;
}
export interface OfficialPaymentAdapter {
 readonly provider:PaymentProvider;
 verifyIncoming(reference:string):Promise<VerifiedProviderPayment>;
 verifyOutgoing(reference:string):Promise<VerifiedProviderPayment>;
}
export const officialPaymentAdapters:ReadonlyMap<PaymentProvider,OfficialPaymentAdapter>=new Map();
export function officialProviderConfigured(provider:PaymentProvider):boolean{return officialPaymentAdapters.has(provider);}
