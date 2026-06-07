import { useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { StripedBarcode } from '@/components/StripedBarcode'
import { barcodeRenderOptions } from '@/lib/barcodeFormat'

function parseDeskItem(raw) {
  const s = raw.trim()
  if (!s) return { barcode: '' }
  return { barcode: s }
}

export function LibrarianDeskPage() {
  const [patronEmail, setPatronEmail] = useState('')
  const [deskItem, setDeskItem] = useState('')
  const [checkoutMsg, setCheckoutMsg] = useState('')
  const [checkoutErr, setCheckoutErr] = useState('')
  const [checkoutPending, setCheckoutPending] = useState(false)
  const [showCheckoutScan, setShowCheckoutScan] = useState(false)

  const [returnKey, setReturnKey] = useState('')
  const [returnMsg, setReturnMsg] = useState('')
  const [returnErr, setReturnErr] = useState('')
  const [returnPending, setReturnPending] = useState(false)
  const [lastReturnFine, setLastReturnFine] = useState(0)
  const [showReturnScan, setShowReturnScan] = useState(false)

  async function handleCheckout(e) {
    e.preventDefault()
    setCheckoutMsg('')
    setCheckoutErr('')
    setCheckoutPending(true)
    const { barcode } = parseDeskItem(deskItem)
    if (!barcode) {
      setCheckoutErr('Scan or paste a barcode (LIB…, ISBN, or catalog barcode).')
      setCheckoutPending(false)
      return
    }
    try {
      const res = await apiFetch('/api/librarian/checkout', {
        method: 'POST',
        body: JSON.stringify({
          patronEmail,
          barcode,
        }),
      })
      const due = res.loan?.dueAt ? new Date(res.loan.dueAt).toLocaleString() : ''
      const bc = res.loan?.bookCopy?.libraryBarcode
      setCheckoutMsg(`Checked out${bc ? ` (copy ${bc})` : ''}. Due: ${due}`)
      setPatronEmail('')
      setDeskItem('')
    } catch (err) {
      setCheckoutErr(err.message || 'Checkout failed')
    } finally {
      setCheckoutPending(false)
    }
  }

  async function handleReturn(e) {
    e.preventDefault()
    setReturnMsg('')
    setReturnErr('')
    setReturnPending(true)
    const trimmed = returnKey.trim()
    if (!trimmed) {
      setReturnErr('Scan a library barcode or enter loan ID.')
      setReturnPending(false)
      return
    }
    const body = { barcode: trimmed }
    try {
      const res = await apiFetch('/api/librarian/return', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setLastReturnFine(res.fineAmount || 0)
      setReturnMsg(res.message || 'Book returned successfully.')
      setReturnKey('')
    } catch (err) {
      setReturnErr(err.message || 'Return failed')
    } finally {
      setReturnPending(false)
    }
  }

  return (
    <div className="b-app max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Desk operations</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          L1.09 — Scan copy barcodes (LIB…), ISBN, or catalog barcode for quick checkout and return.
        </p>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Check out</h2>
        <form onSubmit={handleCheckout} className="mt-4 max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="desk-email">
              Patron email
            </label>
            <input
              id="desk-email"
              type="email"
              required
              value={patronEmail}
              onChange={(e) => setPatronEmail(e.target.value)}
              className={inputClass}
              placeholder="reader@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="desk-item">
              Barcode scan
            </label>
            <input
              id="desk-item"
              required
              value={deskItem}
              onChange={(e) => setDeskItem(e.target.value)}
              className={`${inputClass} font-mono text-sm`}
              placeholder="LIB… / ISBN / catalog barcode"
            />
            {deskItem.trim() && barcodeRenderOptions(deskItem) ? (
              <div className="mt-2">
                <StripedBarcode value={deskItem.trim()} height={44} width={1.5} />
              </div>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowCheckoutScan((v) => !v)}>
            {showCheckoutScan ? 'Hide scanner' : 'Open scanner'}
          </Button>
          {showCheckoutScan ? (
            <BarcodeScanner
              label="Checkout scan"
              onScan={(code) => setDeskItem(code)}
              onClose={() => setShowCheckoutScan(false)}
            />
          ) : null}
          {checkoutErr ? <p className="text-sm text-[#b42318]">{checkoutErr}</p> : null}
          {checkoutMsg ? <p className="text-sm text-[#0d7a4f]">{checkoutMsg}</p> : null}
          <Button type="submit" disabled={checkoutPending}>
            {checkoutPending ? 'Processing…' : 'Confirm checkout'}
          </Button>
        </form>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Return</h2>
        <form onSubmit={handleReturn} className="mt-4 max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="return-key">
              Barcode or loan ID
            </label>
            <input
              id="return-key"
              required
              value={returnKey}
              onChange={(e) => setReturnKey(e.target.value)}
              className={`${inputClass} font-mono text-sm`}
              placeholder="LIB… or loan id"
            />
            {returnKey.trim() && barcodeRenderOptions(returnKey) ? (
              <div className="mt-2">
                <StripedBarcode value={returnKey.trim()} height={44} width={1.5} />
              </div>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowReturnScan((v) => !v)}>
            {showReturnScan ? 'Hide scanner' : 'Open scanner'}
          </Button>
          {showReturnScan ? (
            <BarcodeScanner
              label="Return scan"
              onScan={(code) => setReturnKey(code)}
              onClose={() => setShowReturnScan(false)}
            />
          ) : null}
          {returnErr ? <p className="text-sm text-[#b42318]">{returnErr}</p> : null}
          {returnMsg ? (
            <p className={`text-sm font-medium ${lastReturnFine > 0 ? 'text-[#b42318]' : 'text-[#0d7a4f]'}`}>
              {returnMsg}
            </p>
          ) : null}
          <Button type="submit" disabled={returnPending}>
            {returnPending ? 'Processing…' : 'Confirm return'}
          </Button>
        </form>
      </div>
    </div>
  )
}
