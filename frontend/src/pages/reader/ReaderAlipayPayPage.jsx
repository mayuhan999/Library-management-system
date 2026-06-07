import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

export function ReaderAlipayPayPage() {
  const { paymentId } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const isSimulate = search.get('sandbox') === '1'

  const [payment, setPayment] = useState(null)
  const [payMode, setPayMode] = useState(isSimulate ? 'simulate' : 'alipay_qr')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await apiFetch(`/api/payments/${paymentId}`)
        if (cancelled) return
        setPayment(res.payment)
        setPayMode(res.mode || (isSimulate ? 'simulate' : 'alipay_qr'))
        if (res.payment?.status === 'SUCCESS') {
          setDone(true)
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Payment not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [paymentId, isSimulate])

  useEffect(() => {
    if (!payment?.qrCode || payment.status !== 'PENDING') {
      setQrDataUrl('')
      return undefined
    }

    let cancelled = false
    QRCode.toDataURL(payment.qrCode, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setErr('Could not render payment QR code')
      })

    return () => {
      cancelled = true
    }
  }, [payment?.qrCode, payment?.status])

  useEffect(() => {
    if (!payment || payment.status !== 'PENDING' || payMode !== 'alipay_qr') {
      return undefined
    }

    const timer = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/payments/${paymentId}`)
        setPayment(res.payment)
        if (res.payment?.status === 'SUCCESS') {
          setDone(true)
          clearInterval(timer)
          setTimeout(() => navigate('/reader/account'), 2000)
        }
      } catch {
        /* keep polling */
      }
    }, 2500)

    return () => clearInterval(timer)
  }, [payment, paymentId, payMode, navigate])

  async function confirmPay() {
    setPending(true)
    setErr('')
    try {
      await apiFetch(`/api/payments/${paymentId}/sandbox-confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setDone(true)
      setTimeout(() => navigate('/reader/account'), 2000)
    } catch (e) {
      setErr(e.message || 'Payment failed')
    } finally {
      setPending(false)
    }
  }

  if (loading) return <p className="b-app p-6 text-sm text-[#5c6b7a]">Loading payment…</p>

  const showQr = payMode === 'alipay_qr' && payment?.status === 'PENDING'

  return (
    <div className="b-app mx-auto max-w-md space-y-6 p-6">
      <div className="rounded-sm border border-[#e5e8eb] bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-[#1677ff] px-2 py-1 text-xs font-bold text-white">Alipay</span>
          {payMode === 'simulate' ? (
            <span className="rounded-sm border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
              Simulate
            </span>
          ) : (
            <span className="rounded-sm border border-[#91caff] bg-[#e6f4ff] px-2 py-0.5 text-xs text-[#0958d9]">
              Sandbox QR
            </span>
          )}
        </div>

        {err ? <p className="mb-3 text-sm text-[#b42318]">{err}</p> : null}

        {payment ? (
          <>
            <h1 className="text-lg font-semibold text-[#1a2b3c]">Pay library fine</h1>
            <p className="mt-1 text-sm text-[#5c6b7a]">{payment.subject}</p>
            <p className="mt-4 text-3xl font-bold text-[#1677ff]">¥{payment.amount.toFixed(2)}</p>
            <p className="mt-2 font-mono text-xs text-[#8a96a3]">{payment.outTradeNo}</p>

            {done || payment.status === 'SUCCESS' ? (
              <p className="mt-6 text-sm font-medium text-[#027a48]">Payment successful. Redirecting…</p>
            ) : showQr ? (
              <div className="mt-6 space-y-4 text-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Alipay payment QR code"
                    className="mx-auto rounded-sm border border-[#e5e8eb] bg-white p-2"
                    width={240}
                    height={240}
                  />
                ) : (
                  <p className="text-sm text-[#5c6b7a]">Generating QR code…</p>
                )}
                <div className="rounded-sm bg-[#f5f9ff] p-3 text-left text-xs leading-relaxed text-[#3d4f5f]">
                  <p className="font-semibold text-[#1677ff]">手机扫码步骤</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    <li>手机安装并打开「支付宝沙箱版」</li>
                    <li>使用沙箱买家账号登录（开放平台 → 沙箱 → 买家信息）</li>
                    <li>扫一扫上方二维码，确认付款</li>
                    <li>本页将自动检测支付结果（约 2–5 秒）</li>
                  </ol>
                </div>
                <p className="text-xs text-[#8a96a3]">Waiting for payment…</p>
                <Link to="/reader/account" className="block text-sm text-[#5c6b7a] hover:underline">
                  Cancel
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  className="w-full bg-[#1677ff] hover:bg-[#0958d9]"
                  disabled={pending}
                  onClick={confirmPay}
                >
                  {pending ? 'Processing…' : 'Confirm payment (simulate)'}
                </Button>
                <Link to="/reader/account" className="block text-center text-sm text-[#5c6b7a] hover:underline">
                  Cancel
                </Link>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[#b42318]">Payment not found.</p>
        )}
      </div>
    </div>
  )
}
