const { AlipaySdk } = require('alipay-sdk');

function normalizePem(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '\n').trim();
}

function isAlipayConfigured() {
  return Boolean(
    process.env.ALIPAY_APP_ID &&
      process.env.ALIPAY_PRIVATE_KEY &&
      process.env.ALIPAY_ALIPAY_PUBLIC_KEY,
  );
}

/** Built-in simulate page when credentials are missing or ALIPAY_MODE=simulate */
function useSimulatePage() {
  const mode = (process.env.ALIPAY_MODE || 'sandbox').toLowerCase();
  if (mode === 'simulate') return true;
  return !isAlipayConfigured();
}

function isSandboxMode() {
  if (useSimulatePage()) return true;
  const gateway = (process.env.ALIPAY_GATEWAY || '').toLowerCase();
  return gateway.includes('sandbox') || gateway.includes('alipaydev');
}

function generateOutTradeNo() {
  const crypto = require('crypto');
  return `LIB${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
}

function getNotifyBaseUrl() {
  return (process.env.ALIPAY_NOTIFY_BASE || `http://localhost:${process.env.PORT || 3001}`).replace(
    /\/$/,
    '',
  );
}

function getFrontendBase() {
  return (process.env.FRONTEND_BASE || 'http://localhost:5173').replace(/\/$/, '');
}

function buildPayPageUrl(paymentId) {
  const frontBase = getFrontendBase();
  if (useSimulatePage()) {
    return `${frontBase}/reader/pay/${paymentId}?sandbox=1`;
  }
  return `${frontBase}/reader/pay/${paymentId}?mode=qr`;
}

let sdkInstance = null;

function getSdk() {
  if (!isAlipayConfigured()) return null;
  if (!sdkInstance) {
    sdkInstance = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID,
      privateKey: normalizePem(process.env.ALIPAY_PRIVATE_KEY),
      alipayPublicKey: normalizePem(process.env.ALIPAY_ALIPAY_PUBLIC_KEY),
      gateway:
        process.env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      signType: 'RSA2',
      keyType: process.env.ALIPAY_KEY_TYPE === 'PKCS8' ? 'PKCS8' : 'PKCS1',
    });
  }
  return sdkInstance;
}

function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error('INVALID_PAYMENT_AMOUNT');
    throw err;
  }
  return n.toFixed(2);
}

function pickTradeStatus(result) {
  return result?.tradeStatus || result?.trade_status || null;
}

function pickTradeNo(result) {
  return result?.tradeNo || result?.trade_no || null;
}

function pickQrCode(result) {
  return result?.qrCode || result?.qr_code || null;
}

/**
 * alipay.trade.precreate — merchant displays QR, buyer scans with Alipay app.
 */
async function precreateTrade({ outTradeNo, totalAmount, subject }) {
  const sdk = getSdk();
  if (!sdk) {
    const err = new Error('ALIPAY_NOT_CONFIGURED');
    throw err;
  }

  const result = await sdk.exec('alipay.trade.precreate', {
    notifyUrl: `${getNotifyBaseUrl()}/api/payments/alipay/notify`,
    bizContent: {
      out_trade_no: outTradeNo,
      total_amount: formatAmount(totalAmount),
      subject: String(subject || 'Library fine').slice(0, 128),
    },
  });

  if (result.code !== '10000') {
    const err = new Error(result.subMsg || result.msg || 'ALIPAY_PRECREATE_FAILED');
    err.code = result.subCode || result.code;
    err.alipay = result;
    throw err;
  }

  const qrCode = pickQrCode(result);
  if (!qrCode) {
    const err = new Error('ALIPAY_NO_QR_CODE');
    throw err;
  }

  return { qrCode, raw: result };
}

/** alipay.trade.query — used for polling when async notify cannot reach localhost. */
async function queryTrade(outTradeNo) {
  const sdk = getSdk();
  if (!sdk) return null;

  const result = await sdk.exec('alipay.trade.query', {
    bizContent: {
      out_trade_no: outTradeNo,
    },
  });

  if (result.code !== '10000') {
    return null;
  }

  return result;
}

function verifyNotifySignature(body) {
  if (useSimulatePage()) return true;
  const sdk = getSdk();
  if (!sdk || !body?.sign) return false;
  try {
    return sdk.checkNotifySignV2(body);
  } catch {
    return false;
  }
}

module.exports = {
  isAlipayConfigured,
  useSimulatePage,
  isSandboxMode,
  generateOutTradeNo,
  getNotifyBaseUrl,
  getFrontendBase,
  buildPayPageUrl,
  precreateTrade,
  queryTrade,
  verifyNotifySignature,
  pickTradeStatus,
  pickTradeNo,
};
