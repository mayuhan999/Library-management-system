import { useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

export function LibrarianNewBookPage() {
  const [isbn, setIsbn] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('')
  const [totalCopies, setTotalCopies] = useState('1')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg('')
    setErr('')
    setPending(true)
    try {
      await apiFetch('/api/librarian/books', {
        method: 'POST',
        body: JSON.stringify({
          isbn,
          title,
          author,
          category: category || undefined,
          totalCopies: parseInt(totalCopies, 10) || 1,
        }),
      })
      setMsg('Book added to the catalog.')
      setIsbn('')
      setTitle('')
      setAuthor('')
      setCategory('')
      setTotalCopies('1')
    } catch (e) {
      setErr(e.message || 'Failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="b-app max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Add book</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Register a title and copy count. ISBN must be unique.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-[#e5e8eb] bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">ISBN</label>
          <input required value={isbn} onChange={(e) => setIsbn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Author</label>
          <input required value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Category (optional)</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Copies</label>
            <input type="number" min={1} value={totalCopies} onChange={(e) => setTotalCopies(e.target.value)} className={inputClass} />
          </div>
        </div>
        {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
        {msg ? <p className="text-sm text-[#0d7a4f]">{msg}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add to catalog'}
        </Button>
      </form>
    </div>
  )
}
