import { useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

export function LibrarianDeskPage() {
  const [patronEmail, setPatronEmail] = useState('')
  const [bookId, setBookId] = useState('')
  const [checkoutMsg, setCheckoutMsg] = useState('')
  const [checkoutErr, setCheckoutErr] = useState('')
  const [checkoutPending, setCheckoutPending] = useState(false)

  async function handleCheckout(e) {
    e.preventDefault()
    setCheckoutMsg('')
    setCheckoutErr('')
    setCheckoutPending(true)
    try {
      const res = await apiFetch('/api/librarian/checkout', {
        method: 'POST',
        body: JSON.stringify({ patronEmail, bookId }),
      })
      const due = res.loan?.dueAt ? new Date(res.loan.dueAt).toLocaleString() : ''
      setCheckoutMsg(`Checked out. Due: ${due}`)
      setPatronEmail('')
      setBookId('')
    } catch (err) {
      setCheckoutErr(err.message || 'Checkout failed')
    } finally {
      setCheckoutPending(false)
    }
  }

  return (
    <div className="b-app max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Desk checkout</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Verify patron email and book ID (copy from catalog or book detail).</p>
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
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="desk-book">
              Book ID
            </label>
            <input
              id="desk-book"
              required
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className={inputClass}
              placeholder="Paste book ID from the system"
            />
          </div>
          {checkoutErr ? <p className="text-sm text-[#b42318]">{checkoutErr}</p> : null}
          {checkoutMsg ? <p className="text-sm text-[#0d7a4f]">{checkoutMsg}</p> : null}
          <Button type="submit" disabled={checkoutPending}>
            {checkoutPending ? 'Processing…' : 'Confirm checkout'}
          </Button>
        </form>
      </div>

      <p className="text-xs text-[#5c6b7a]">
        Returns and renewals will be expanded in a later release; Release 1 focuses on checkout and catalog management.
      </p>
    </div>
  )
}
