import type { CalculatorInput, ExchangeRateSnapshot, QuoteResult } from './types';
import { validateInput } from './validation';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function calculateQuote(input: CalculatorInput, rates: ExchangeRateSnapshot): QuoteResult {
  const validation = validateInput(input);
  if (!validation.valid) throw new Error(validation.errors.join('；'));
  const remainingDays = Math.max(0, Math.ceil((parseLocalDate(input.expiryDate) - parseLocalDate(input.tradeDate)) / DAY_MS));
  const cycleDays = Math.max(1, Math.round(input.paymentCycleMonths * 30));
  const renewalPriceCny = input.renewalAmount * rates.renewalToCny;
  const theoreticalValue = remainingDays === 0
    ? 0
    : renewalPriceCny * Math.min(remainingDays / cycleDays, 1);
  const adjustedValue = theoreticalValue * (1 - input.discountRate / 100);
  const pushFeeCny = input.pushFeeAmount * rates.pushToCny;
  const sellerFeeRate = input.feeMode === 'buyer' ? 0 : input.feeMode === 'seller' ? 100 : input.sellerFeeRate;
  const includedPushFee = pushFeeCny * (1 - sellerFeeRate / 100);
  const premiumAmount = input.premiumAmount ?? 0;
  const totalPrice = input.salePrice + premiumAmount + includedPushFee;
  const premium = totalPrice - adjustedValue;
  const premiumRate = adjustedValue > 0 ? premium / adjustedValue * 100 : 0;
  return {
    remainingDays,
    cycleDays,
    renewalPriceCny,
    theoreticalValue,
    adjustedValue,
    discountRate: input.discountRate,
    pushFeeCny,
    sellerFeeRate,
    includedPushFee,
    baseSalePrice: input.salePrice,
    premiumAmount,
    totalPrice,
    buyerTotal: totalPrice,
    sellerNet: totalPrice,
    premium,
    premiumRate,
  };
}
