const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  createFinePayment,
  markPaymentSuccess,
  handleAlipayNotify,
  getPaymentForUser,
  useSimulatePage,
} = require('../lib/paymentService');
const { verifyNotifySignature } = require('../lib/alipay');

const router = express.Router();

/** Alipay async notify (must be public — use ngrok in local dev for production-like flow). */
router.post('/alipay/notify', express.urlencoded({ extended: false }), async (req, res) => {
  const body = req.body || {};
  const outTradeNo = body.out_trade_no || body.outTradeNo;
  const tradeNo = body.trade_no || body.tradeNo;
  const tradeStatus = body.trade_status || body.tradeStatus;

  if (!outTradeNo) {
    return res.status(400).send('fail');
  }

  if (!verifyNotifySignature(body)) {
    return res.status(400).send('fail');
  }

  try {
    await handleAlipayNotify(outTradeNo, tradeNo, JSON.stringify(body), tradeStatus);
    return res.send('success');
  } catch {
    return res.send('fail');
  }
});

router.use(requireAuth);

/** Reader: create Alipay order for unpaid fine. */
router.post('/fines/:loanId/alipay', requireRole(['MEMBER']), async (req, res) => {
  try {
    const result = await createFinePayment(req.userId, req.params.loanId);
    res.json({
      payment: result.payment,
      payUrl: result.payUrl,
      reused: result.reused,
      mode: result.mode,
    });
  } catch (e) {
    if (e.message === 'UNPAID_FINE_NOT_FOUND') {
      return res.status(404).json({ error: 'Unpaid fine not found' });
    }
    if (e.message === 'ALIPAY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Alipay is not configured on the server' });
    }
    if (String(e.message).startsWith('ALIPAY_')) {
      return res.status(502).json({
        error: e.message,
        detail: e.alipay?.subMsg || e.alipay?.msg || e.message,
      });
    }
    throw e;
  }
});

/** Reader / admin: payment status (polls Alipay when pending). */
router.get('/:id', requireRole(['MEMBER', 'ADMIN']), async (req, res) => {
  const payment = await getPaymentForUser(req.params.id, req.userId, req.userRole);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json({
    payment,
    mode: useSimulatePage() ? 'simulate' : 'alipay_qr',
  });
});

/** Built-in simulate confirm — only when real Alipay credentials are not set. */
router.post('/:id/sandbox-confirm', requireRole(['MEMBER']), async (req, res) => {
  if (!useSimulatePage()) {
    return res.status(400).json({ error: 'Real Alipay is enabled — pay by scanning the QR code' });
  }
  try {
    const payment = await markPaymentSuccess(
      req.params.id,
      req.userId,
      `SANDBOX${Date.now()}`,
    );
    res.json({ ok: true, payment });
  } catch (e) {
    if (e.message === 'PAYMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Pending payment not found' });
    }
    throw e;
  }
});

module.exports = router;
