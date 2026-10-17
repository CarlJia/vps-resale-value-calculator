import './styles.css';
import { calculateQuote } from './domain/calculator';
import type { CalculatorInput } from './domain/types';
import { validateInput } from './domain/validation';
import { fetchRequiredRates, ExchangeRateError } from './services/exchange-rate';
import { decodeSharePayload, encodeSharePayload } from './services/share-codec';
import { buildMarkdown, downloadBlob, downloadQuoteImage } from './services/export';
import { bindCurrencyComboboxes } from './ui/combobox';
import { fillForm, readForm, renderForm, updateFeeModeVisibility } from './ui/form';
import { renderResult } from './ui/result';

const app = document.querySelector<HTMLDivElement>('#app')!;
const today = new Date();
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const shared = decodeSharePayload(window.location.hash);
const defaultInput = (): CalculatorInput => ({
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: isoDate(today), expiryDate: isoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())),
  salePrice: 0, premiumAmount: 0, accountBalance: 0, discountRate: 0, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '', productName: '', highlight: '', cpu: '', memory: '', memoryUnit: 'GB', storage: '', storageUnit: 'GB', bandwidth: '', bandwidthUnit: 'Mbps', traffic: '', trafficUnit: 'TB', trafficResetCycle: 'monthly', trafficDirection: 'double', location: '',
});

const editView = `<section class="input-panel">${renderForm()}</section><section id="result-container" class="result-container"><div class="empty-result"><span>报价结果</span><strong>填写左侧信息后开始计算</strong><p>结果、手续费明细与分享操作会固定显示在这里。</p></div></section>`;
const shareView = `<section class="share-view"><div class="share-view-heading"><p class="eyebrow">VPS RESALE RESULT</p><h1>报价结果</h1><span class="readonly-banner">分享结果 · 只读展示</span></div><section id="result-container" class="result-container"><div class="empty-result"><span>报价结果</span><strong>正在加载报价</strong><p>汇率获取成功后会显示完整结果。</p></div></section></section>`;

/** 汇率未就位时的结果区占位：换走旧币种的金额与导出入口，只留状态与恢复动作。 */
function showRatesPlaceholder(state: 'loading' | 'error'): void {
  const container = document.querySelector('#result-container');
  if (!container) return;
  const title = state === 'loading' ? '正在获取汇率' : '汇率获取失败';
  const hint = state === 'loading' ? '汇率返回后会显示完整报价。' : '重新选择任一币种，或点击重置，即可重新获取汇率。';
  container.innerHTML = `<div class="empty-result"><span>报价结果</span><strong>${title}</strong><p>${hint}</p></div>`;
}
const editPage = `<header class="site-header"><div class="brand-mark">V</div><div><strong>VPS 价值计算器</strong><span>转售报价工作台</span></div><a href="https://www.frankfurter.app/" target="_blank" rel="noreferrer">汇率来源</a></header><main class="page-shell"><section class="intro"><div><p class="eyebrow">VPS RESALE TOOL / 2026</p><h1>把剩余价值，<em>算成一份报价。</em></h1><p>输入续费周期、折损与 Push 手续费，实时得到可解释的转售价格。所有数据只留在浏览器里。</p></div><div class="intro-rule"><span></span><small>单台 VPS · 无需登录</small></div></section><div id="alert" class="alert" role="status" aria-live="polite"></div><div class="workspace">${editView}</div></main><footer><span>纯前端运行 · 分享链接不经过服务器存储</span><a href="https://www.frankfurter.app/" target="_blank" rel="noreferrer">Frankfurter 汇率服务</a></footer>`;
const sharePage = `<main class="share-page">${shareView}</main>`;
app.innerHTML = shared ? sharePage : editPage;
app.classList.toggle('share-mode', Boolean(shared));
bindCurrencyComboboxes(app);

const alertBox = document.querySelector<HTMLDivElement>('#alert');
const rateStatus = document.querySelector<HTMLSpanElement>('#rate-status');
const renewalCny = document.querySelector<HTMLElement>('#renewal-cny');
const calculatorForm = document.querySelector<HTMLFormElement>('#calculator-form');
let rateTime = '';
let lastQuote: ReturnType<typeof calculateQuote> | null = null;
let lastInput: CalculatorInput | null = null;
let ratesRequestId = 0;

function setReadonlyMode(readonly: boolean): void {
  if (!calculatorForm) return;
  calculatorForm.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((element) => { element.disabled = readonly; });
  document.querySelector<HTMLButtonElement>('#reset-button')?.classList.toggle('hidden', readonly);
}

function setAlert(message: string, kind: 'error' | 'success' | ''): void { if (alertBox) { alertBox.textContent = message; alertBox.className = `alert ${kind}`; } }

function updateRenewalCny(): void {
  if (!calculatorForm || !renewalCny) return;
  const input = shared?.input ?? readForm();
  const balanceCurrency = document.querySelector<HTMLElement>('#balance-currency');
  if (balanceCurrency) balanceCurrency.textContent = input.renewalCurrency;
  const rates = (window as Window & { __rates?: { renewalToCny: number } }).__rates;
  if (renewalCny) renewalCny.textContent = rates && Number.isFinite(input.renewalAmount) ? `¥${(input.renewalAmount * rates.renewalToCny).toFixed(2)}` : '等待汇率';
}

function updateAutoSalePrice(): void {
  if (!calculatorForm) return;
  const input = readForm();
  const rates = (window as Window & { __rates?: { renewalToCny: number; pushToCny: number; fetchedAt: string } }).__rates;
  const field = document.querySelector<HTMLInputElement>('#sale-price');
  if (!field || !rates || !rateTime) return;
  try {
    const quote = calculateQuote({ ...input, salePrice: 0 }, rates);
    field.value = quote.adjustedValue.toFixed(2);
  } catch {
    // 输入尚不完整时保留当前值，等待下一次有效变更。
  }
}

async function loadRates(): Promise<void> {
  const requestId = ++ratesRequestId;
  const input = shared?.input ?? readForm();
  rateTime = '';
  (window as Window & { __rates?: unknown }).__rates = undefined;
  updateRenewalCny();
  showRatesPlaceholder('loading');
  if (rateStatus) { rateStatus.textContent = '正在获取汇率'; rateStatus.className = 'status-chip loading'; }
  try {
    const rates = await fetchRequiredRates(input.renewalCurrency, input.pushFeeCurrency);
    if (requestId !== ratesRequestId) return;
    rateTime = rates.fetchedAt;
    (window as Window & { __rates?: typeof rates }).__rates = rates;
    if (rateStatus) { rateStatus.textContent = `汇率已更新 ${new Date(rateTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`; rateStatus.className = 'status-chip ready'; }
    updateRenewalCny();
    updateAutoSalePrice();
    setAlert('', '');
    void calculateAndRender();
  } catch (error) {
    if (requestId !== ratesRequestId) return;
    showRatesPlaceholder('error');
    if (rateStatus) { rateStatus.textContent = '汇率获取失败'; rateStatus.className = 'status-chip error'; }
    setAlert(error instanceof ExchangeRateError ? error.message : '无法获取汇率，请稍后重试', 'error');
  }
}

async function calculateAndRender(showMessage = false): Promise<void> {
  const input = shared?.input ?? readForm(); const validation = validateInput(input);
  if (!validation.valid) { if (showMessage) setAlert(validation.errors[0], 'error'); return; }
  const rates = (window as Window & { __rates?: { renewalToCny: number; pushToCny: number; fetchedAt: string } }).__rates;
  if (!rates || !rateTime) { if (showMessage) setAlert('汇率尚未获取成功，无法计算报价', 'error'); return; }
  try {
    const quote = calculateQuote(input, rates); lastInput = input; lastQuote = quote;
    document.querySelector('#result-container')!.innerHTML = renderResult(input, quote, rateTime); bindResultActions();
    setAlert(showMessage ? '报价已更新' : '', showMessage ? 'success' : '');
  } catch (error) { if (showMessage) setAlert(error instanceof Error ? error.message : '输入数据无效', 'error'); }
}

function bindResultActions(): void {
  if (!lastInput || !lastQuote) return;
  const input = lastInput; const quote = lastQuote; const markdown = buildMarkdown(input, quote, rateTime); (document.querySelector('#markdown-output') as HTMLTextAreaElement).value = markdown;
  document.querySelector('#share-button')?.addEventListener('click', async () => { const hash = encodeSharePayload(input); const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`; if (hash.length > 12000) { setAlert('分享数据过长，请改用图片或 Markdown', 'error'); return; } history.replaceState(null, '', shareUrl); try { await navigator.clipboard.writeText(shareUrl); setAlert('分享链接已复制', 'success'); } catch { setAlert(`分享链接已生成：${shareUrl}`, 'success'); } });
  document.querySelector('#markdown-button')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(markdown); setAlert('Markdown 已复制', 'success'); } catch { downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), 'vps报价.md'); setAlert('剪贴板不可用，已下载 Markdown 文件', 'success'); } });
  document.querySelector('#image-button')?.addEventListener('click', async () => { try { await downloadQuoteImage(input, quote, rateTime); setAlert('报价图片已下载', 'success'); } catch (error) { setAlert(error instanceof Error ? error.message : '图片导出失败，可使用 Markdown', 'error'); } });
}

calculatorForm?.addEventListener('submit', (event) => { event.preventDefault(); void calculateAndRender(true); });
calculatorForm?.addEventListener('input', () => { updateRenewalCny(); updateAutoSalePrice(); void calculateAndRender(); });
calculatorForm?.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.id === 'renewal-currency' || target.id === 'push-fee-currency') void loadRates();
  else { updateFeeModeVisibility(); updateAutoSalePrice(); void calculateAndRender(); }
});
document.querySelector('#reset-button')?.addEventListener('click', () => { fillForm(defaultInput()); void loadRates(); setAlert('', ''); });
if (!shared) fillForm(defaultInput());
void loadRates();
