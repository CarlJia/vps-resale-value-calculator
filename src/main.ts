import './styles.css';
import { calculateQuote } from './domain/calculator';
import { formatCny } from './domain/money';
import type { CalculatorInput } from './domain/types';
import { validateInput } from './domain/validation';
import { fetchRequiredRates, ExchangeRateError } from './services/exchange-rate';
import { decodeSharePayload, encodeSharePayload } from './services/share-codec';
import { buildMarkdown, downloadBlob, downloadQuoteImage } from './services/export';
import { bindCurrencyComboboxes, closeCurrencyComboboxes } from './ui/combobox';
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

/** 结果区空态与占位共用的骨架，三处都从这里出，避免同一段 markup 各写一份。 */
const emptyResult = (title: string, hint: string) => `<div class="empty-result"><span>报价结果</span><strong>${title}</strong><p>${hint}</p></div>`;

const editView = `<section class="input-panel">${renderForm()}</section><section id="result-container" class="result-container">${emptyResult('填写左侧信息后开始计算', '结果、手续费明细与分享操作会固定显示在这里。')}</section>`;
const shareView = `<section class="share-view"><div class="share-view-heading"><p class="eyebrow">VPS RESALE RESULT</p><h1>报价结果</h1><span class="readonly-banner">分享结果 · 只读展示</span></div><section id="result-container" class="result-container">${emptyResult('正在加载报价', '汇率获取成功后会显示完整结果。')}</section></section>`;

/** 汇率未就位、失败或输入待修正时的结果区占位：换走旧币种的金额与导出入口，只留状态与恢复动作。 */
function showRatesPlaceholder(state: 'loading' | 'error' | 'invalid', detail = ''): void {
  const container = document.querySelector('#result-container');
  if (!container) return;
  const title = state === 'loading' ? '正在获取汇率' : state === 'invalid' ? '输入待修正' : '汇率获取失败';
  // 分享页没有表单也没有 #alert：恢复动作与失败原因都得写进占位本身，否则收件人看不到任何可行动的线索。
  const action = calculatorForm ? '重新选择任一币种，或点击重置，即可重新获取汇率。' : '汇率暂时不可用，请稍后重新打开此链接。';
  const hint = state === 'loading'
    ? '汇率返回后会显示完整报价。'
    : state === 'invalid'
      ? `${detail ? `${detail}，` : ''}修正后会重新显示报价。`
      : `${detail ? `${detail}。` : ''}${action}`;
  container.innerHTML = emptyResult(title, hint);
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
  if (renewalCny) renewalCny.textContent = rates && Number.isFinite(input.renewalAmount) ? formatCny(input.renewalAmount * rates.renewalToCny) : '等待汇率';
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
    if (!(await calculateAndRender())) {
      const pending = validateInput(shared?.input ?? readForm());
      showRatesPlaceholder('invalid', pending.valid ? '' : pending.errors[0]);
    }
  } catch (error) {
    if (requestId !== ratesRequestId) return;
    const message = error instanceof ExchangeRateError ? error.message : '无法获取汇率，请稍后重试';
    showRatesPlaceholder('error', message);
    if (rateStatus) { rateStatus.textContent = '汇率获取失败'; rateStatus.className = 'status-chip error'; }
    setAlert(message, 'error');
  }
}

async function calculateAndRender(showMessage = false): Promise<boolean> {
  const input = shared?.input ?? readForm(); const validation = validateInput(input);
  if (!validation.valid) { if (showMessage) setAlert(validation.errors[0], 'error'); return false; }
  const rates = (window as Window & { __rates?: { renewalToCny: number; pushToCny: number; fetchedAt: string } }).__rates;
  if (!rates || !rateTime) { if (showMessage) setAlert('汇率尚未获取成功，无法计算报价', 'error'); return false; }
  try {
    const quote = calculateQuote(input, rates); lastInput = input; lastQuote = quote;
    document.querySelector('#result-container')!.innerHTML = renderResult(input, quote, rateTime); bindResultActions();
    setAlert(showMessage ? '报价已更新' : '', showMessage ? 'success' : '');
    return true;
  } catch (error) { if (showMessage) setAlert(error instanceof Error ? error.message : '输入数据无效', 'error'); return false; }
}

/** 点击后的就地反馈：按钮文案切换两秒再复位，免得反馈只落在顶部的提示条上（分享页连提示条都没有）。 */
function flashButton(button: Element | null, text: string, ok: boolean): void {
  if (!(button instanceof HTMLElement)) return;
  const label = button.dataset.label ?? button.textContent ?? '';
  button.dataset.label = label;
  button.textContent = text;
  button.classList.toggle('done', ok);
  button.classList.toggle('failed', !ok);
  window.setTimeout(() => {
    if (button.textContent !== text) return; // 期间又点了一次，让那次自己的计时器负责复位
    button.textContent = label;
    button.classList.remove('done', 'failed');
  }, 2000);
}

/** 编辑视图沿用顶部提示条；分享视图没有 #alert，反馈落到结果区自己的状态区，否则点了没反应。 */
function announce(message: string, kind: 'error' | 'success' | ''): void {
  if (alertBox) { setAlert(message, kind); return; }
  const status = document.querySelector<HTMLElement>('#action-status');
  if (status) status.textContent = message;
}

function bindResultActions(): void {
  if (!lastInput || !lastQuote) return;
  const input = lastInput; const quote = lastQuote; const markdown = buildMarkdown(input, quote, rateTime); (document.querySelector('#markdown-output') as HTMLTextAreaElement).value = markdown;
  const shareButton = document.querySelector('#share-button');
  const imageButton = document.querySelector('#image-button');
  const markdownButton = document.querySelector('#markdown-button');

  shareButton?.addEventListener('click', async () => {
    const hash = encodeSharePayload(input);
    const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    if (hash.length > 12000) { flashButton(shareButton, '数据过长', false); announce('分享数据过长，请改用图片或 Markdown', 'error'); return; }
    history.replaceState(null, '', shareUrl);
    try { await navigator.clipboard.writeText(shareUrl); flashButton(shareButton, '已复制链接', true); announce('分享链接已复制', 'success'); }
    catch { flashButton(shareButton, '链接已生成', true); announce(`分享链接已生成：${shareUrl}`, 'success'); }
  });

  markdownButton?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(markdown); flashButton(markdownButton, '已复制 Markdown', true); announce('Markdown 已复制', 'success'); }
    catch {
      try {
        downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), 'vps报价.md');
        flashButton(markdownButton, '已下载 .md', true); announce('剪贴板不可用，已下载 Markdown 文件', 'success');
      } catch { flashButton(markdownButton, '导出失败', false); announce('Markdown 导出失败，请改用图片或手动复制', 'error'); }
    }
  });

  imageButton?.addEventListener('click', async () => {
    try { await downloadQuoteImage(input, quote, rateTime); flashButton(imageButton, '图片已下载', true); announce('报价图片已下载', 'success'); }
    catch (error) { flashButton(imageButton, '导出失败', false); announce(error instanceof Error ? error.message : '图片导出失败，可使用 Markdown', 'error'); }
  });
}

calculatorForm?.addEventListener('submit', (event) => { event.preventDefault(); void calculateAndRender(true); });
calculatorForm?.addEventListener('input', () => { updateRenewalCny(); updateAutoSalePrice(); void calculateAndRender(); });
calculatorForm?.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.id === 'renewal-currency' || target.id === 'push-fee-currency') void loadRates();
  else { updateFeeModeVisibility(); updateAutoSalePrice(); void calculateAndRender(); }
});
// 复位必须自己关掉弹层：用键盘激活重置按钮不会派发 mousedown，document 上的「点外面关闭」接不到。
document.querySelector('#reset-button')?.addEventListener('click', () => { closeCurrencyComboboxes(document); fillForm(defaultInput()); void loadRates(); setAlert('', ''); });
if (!shared) fillForm(defaultInput());
void loadRates();
