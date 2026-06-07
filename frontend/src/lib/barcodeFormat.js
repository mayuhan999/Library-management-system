/** Pick JsBarcode format: EAN-13 for 13-digit ISBN, Code128 for LIB / other. */
export function barcodeRenderOptions(value) {
  const clean = String(value || '').replace(/[-\s]/g, '').trim()
  if (!clean) return null

  if (/^\d{13}$/.test(clean)) {
    return { value: clean, format: 'EAN13' }
  }
  if (/^\d{12}$/.test(clean)) {
    return { value: clean, format: 'UPC' }
  }
  return { value: clean, format: 'CODE128' }
}

export function isbnForEan(isbn) {
  const clean = String(isbn || '').replace(/[-\s]/g, '')
  if (/^\d{13}$/.test(clean)) return clean
  return null
}
