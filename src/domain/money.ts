/** 人民币金额。结果区与两种导出共用这一处，避免同一格式在多处各写一份。 */
export const formatCny = (value: number) => `¥${value.toFixed(2)}`;

/** 人民币金额加括注的原币金额与币种，用于账户余额这类需要标明原币的明细。 */
export const formatCnyWithOriginal = (value: number, amount: number, currency: string) => `${formatCny(value)}（${amount.toFixed(2)} ${currency}）`;
