const { prisma } = require('./prisma');
const {
  generateOutTradeNo,
  buildPayPageUrl,
  precreateTrade,
  queryTrade,
  useSimulatePage,
  pickTradeStatus,
  pickTradeNo,
  isAlipayConfigured,
} = require('./alipay');

async function completePayment(tx, payment, tradeNo, notifyRaw) {
  if (payment.status === 'SUCCESS') {
    return payment;
  }

  const updated = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      tradeNo: tradeNo || `SANDBOX-${Date.now()}`,
      paidAt: new Date(),
      notifyRaw: notifyRaw || null,
    },
  });

  if (payment.loanId) {
    await tx.loan.update({
      where: { id: payment.loanId },
      data: { finePaid: true },
    });
  }

  await tx.auditLog.create({
    data: {
      userId: payment.userId,
      action: 'UPDATE',
      entityType: 'Payment',
      entityId: payment.id,
      details: JSON.stringify({
        action: 'ALIPAY_PAID',
        loanId: payment.loanId,
        amount: payment.amount,
        outTradeNo: payment.outTradeNo,
      }),
    },
  });

  return updated;
}

async function ensurePrecreateQr(payment) {
  if (useSimulatePage() || payment.qrCode) {
    return payment;
  }

  const { qrCode } = await precreateTrade({
    outTradeNo: payment.outTradeNo,
    totalAmount: payment.amount,
    subject: payment.subject || 'Library fine',
  });

  return prisma.payment.update({
    where: { id: payment.id },
    data: { qrCode },
  });
}

async function syncPaymentFromAlipay(payment) {
  if (!payment || payment.status !== 'PENDING' || useSimulatePage()) {
    return payment;
  }

  const result = await queryTrade(payment.outTradeNo);
  if (!result) return payment;

  const tradeStatus = pickTradeStatus(result);
  if (tradeStatus !== 'TRADE_SUCCESS') {
    return payment;
  }

  return prisma.$transaction((tx) =>
    completePayment(tx, payment, pickTradeNo(result), JSON.stringify(result)),
  );
}

async function createFinePayment(userId, loanId) {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId, fineAmount: { gt: 0 }, finePaid: false },
    include: { book: { select: { title: true } } },
  });
  if (!loan) {
    const err = new Error('UNPAID_FINE_NOT_FOUND');
    throw err;
  }

  const pending = await prisma.payment.findFirst({
    where: { loanId, userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  if (pending) {
    const withQr = await ensurePrecreateQr(pending);
    return {
      payment: withQr,
      payUrl: buildPayPageUrl(withQr.id),
      reused: true,
      mode: useSimulatePage() ? 'simulate' : 'alipay_qr',
    };
  }

  const outTradeNo = generateOutTradeNo();
  let payment = await prisma.payment.create({
    data: {
      userId,
      loanId,
      amount: loan.fineAmount,
      provider: 'ALIPAY',
      status: 'PENDING',
      outTradeNo,
      subject: `Library fine — ${loan.book.title}`,
    },
  });

  if (!useSimulatePage()) {
    payment = await ensurePrecreateQr(payment);
  }

  return {
    payment,
    payUrl: buildPayPageUrl(payment.id),
    reused: false,
    mode: useSimulatePage() ? 'simulate' : 'alipay_qr',
  };
}

async function getPaymentForUser(paymentId, userId, userRole) {
  let payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      ...(userRole === 'MEMBER' ? { userId } : {}),
    },
    include: {
      loan: { include: { book: { select: { title: true, isbn: true } } } },
      user: { select: { email: true, fullName: true } },
    },
  });

  if (!payment) return null;

  payment = await syncPaymentFromAlipay(payment);
  return payment;
}

async function markPaymentSuccess(paymentId, userId, tradeNo) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId, status: 'PENDING' },
  });
  if (!payment) {
    const err = new Error('PAYMENT_NOT_FOUND');
    throw err;
  }

  return prisma.$transaction((tx) =>
    completePayment(tx, payment, tradeNo, JSON.stringify({ source: 'sandbox_confirm' })),
  );
}

async function handleAlipayNotify(outTradeNo, tradeNo, raw, tradeStatus) {
  if (tradeStatus && tradeStatus !== 'TRADE_SUCCESS') {
    return null;
  }

  const payment = await prisma.payment.findUnique({ where: { outTradeNo } });
  if (!payment) return null;

  return prisma.$transaction((tx) =>
    completePayment(tx, payment, tradeNo, typeof raw === 'string' ? raw : JSON.stringify(raw)),
  );
}

module.exports = {
  createFinePayment,
  markPaymentSuccess,
  handleAlipayNotify,
  completePayment,
  syncPaymentFromAlipay,
  getPaymentForUser,
  isAlipayConfigured,
  useSimulatePage,
};
