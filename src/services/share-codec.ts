import type { CalculatorInput, SharePayload } from '../domain/types';

const MAX_FRAGMENT_LENGTH = 12000;
const ALLOWED_KEYS: Array<keyof CalculatorInput> = [
  'renewalAmount', 'renewalCurrency', 'paymentCycleMonths', 'tradeDate', 'expiryDate', 'salePrice', 'premiumAmount', 'accountBalance', 'discountRate',
  'pushFeeAmount', 'pushFeeCurrency', 'feeMode', 'sellerFeeRate', 'provider', 'productName', 'highlight', 'cpu',
  'memory', 'memoryUnit', 'storage', 'storageUnit', 'bandwidth', 'bandwidthUnit', 'traffic', 'trafficUnit', 'trafficResetCycle', 'trafficDirection', 'location',
];

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSharePayload(input: CalculatorInput): string {
  const cleanInput = Object.fromEntries(ALLOWED_KEYS.map((key) => [key, input[key]]));
  return `#q=${encodeBase64Url(JSON.stringify({ v: 1, input: cleanInput }))}`;
}

export function decodeSharePayload(hash: string): SharePayload | null {
  if (!hash.startsWith('#q=')) return null;
  const encoded = hash.slice(3);
  if (!encoded || encoded.length > MAX_FRAGMENT_LENGTH) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<SharePayload>;
    if (parsed.v !== 1 || !parsed.input || typeof parsed.input !== 'object') return null;
    const input = parsed.input as Partial<CalculatorInput>;
    const unknown = Object.keys(input).some((key) => !ALLOWED_KEYS.includes(key as keyof CalculatorInput));
    if (unknown) return null;
    for (const key of ALLOWED_KEYS) if (!['premiumAmount', 'accountBalance', 'memoryUnit', 'storageUnit', 'bandwidthUnit', 'trafficUnit', 'trafficResetCycle', 'trafficDirection'].includes(key) && !(key in input)) return null;
    return { v: 1, input: input as CalculatorInput };
  } catch {
    return null;
  }
}
