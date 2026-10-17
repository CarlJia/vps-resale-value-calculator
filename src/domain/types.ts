export type CurrencyCode = string;

export type FeeMode = 'buyer' | 'seller' | 'split';
export type TrafficDirection = 'single' | 'double';

export interface CalculatorInput {
  renewalAmount: number;
  renewalCurrency: CurrencyCode;
  paymentCycleMonths: number;
  tradeDate: string;
  expiryDate: string;
  salePrice: number;
  premiumAmount?: number;
  accountBalance?: number;
  discountRate: number;
  pushFeeAmount: number;
  pushFeeCurrency: CurrencyCode;
  feeMode: FeeMode;
  sellerFeeRate: number;
  provider: string;
  productName: string;
  highlight: string;
  cpu: string;
  memory: string;
  memoryUnit?: string;
  storage: string;
  storageUnit?: string;
  bandwidth: string;
  bandwidthUnit?: string;
  traffic: string;
  trafficUnit?: string;
  trafficResetCycle?: string;
  trafficDirection?: TrafficDirection;
  location: string;
}

export interface ExchangeRateSnapshot {
  renewalToCny: number;
  pushToCny: number;
  fetchedAt: string;
}

export interface QuoteResult {
  remainingDays: number;
  cycleDays: number;
  renewalPriceCny: number;
  theoreticalValue: number;
  adjustedValue: number;
  discountRate: number;
  pushFeeCny: number;
  sellerFeeRate: number;
  includedPushFee: number;
  baseSalePrice: number;
  premiumAmount: number;
  balanceCny: number;
  balanceAmount: number;
  balanceCurrency: CurrencyCode;
  totalPrice: number;
  buyerTotal: number;
  sellerNet: number;
  premium: number;
  premiumRate: number;
}

export interface SharePayload {
  v: 1;
  input: CalculatorInput;
}
