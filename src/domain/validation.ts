import type { CalculatorInput } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateInput(input: CalculatorInput): ValidationResult {
  const errors: string[] = [];
  if (!Number.isFinite(input.renewalAmount) || input.renewalAmount < 0) errors.push('续费金额必须是非负数字');
  if (!Number.isFinite(input.salePrice) || input.salePrice < 0) errors.push('剩余价值必须是非负数字');
  if (input.premiumAmount !== undefined && (!Number.isFinite(input.premiumAmount) || input.premiumAmount < 0)) errors.push('溢价必须是非负数字');
  if (input.accountBalance !== undefined && (!Number.isFinite(input.accountBalance) || input.accountBalance < 0)) errors.push('账户余额必须是非负数字');
  if (!Number.isFinite(input.pushFeeAmount) || input.pushFeeAmount < 0) errors.push('Push 手续费必须是非负数字');
  if (!Number.isFinite(input.discountRate) || input.discountRate < 0 || input.discountRate > 100) errors.push('折损率必须在 0% 到 100% 之间');
  if (!Number.isFinite(input.sellerFeeRate) || input.sellerFeeRate < 0 || input.sellerFeeRate > 100) errors.push('卖家承担比例必须在 0% 到 100% 之间');
  if (!/^[A-Z]{3}$/.test(input.renewalCurrency) || !/^[A-Z]{3}$/.test(input.pushFeeCurrency)) errors.push('货币必须使用 3 位大写代码');
  if (!isValidDate(input.tradeDate) || !isValidDate(input.expiryDate)) errors.push('请填写有效的交易日期和到期日期');
  if (!Number.isFinite(input.paymentCycleMonths) || input.paymentCycleMonths <= 0) errors.push('付款周期必须是大于 0 的数字');
  if (!['buyer', 'seller', 'split'].includes(input.feeMode)) errors.push('手续费承担方式无效');
  if (input.trafficDirection !== undefined && !['single', 'double'].includes(input.trafficDirection)) errors.push('流量方向无效');
  return { valid: errors.length === 0, errors };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
