import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { barcodeRenderOptions } from '@/lib/barcodeFormat'

/**
 * Renders a standard black-on-white striped barcode (Code128 / EAN-13).
 */
export function StripedBarcode({
  value,
  format,
  height = 52,
  width = 2,
  label,
  className = '',
  showValue = true,
}) {
  const svgRef = useRef(null)

  useEffect(() => {
    const el = svgRef.current
    if (!el || !value) return

    const picked = format ? { value: String(value).replace(/[-\s]/g, ''), format } : barcodeRenderOptions(value)
    if (!picked) return

    while (el.firstChild) el.removeChild(el.firstChild)
    try {
      JsBarcode(el, picked.value, {
        format: picked.format,
        width,
        height,
        displayValue: showValue,
        fontSize: 12,
        margin: 8,
        lineColor: '#000000',
        background: '#ffffff',
        textAlign: 'center',
        textMargin: 4,
      })
    } catch {
      /* invalid barcode value */
    }
  }, [value, format, height, width, showValue])

  if (!value) return null

  return (
    <div className={`inline-block rounded-sm border border-[#e5e8eb] bg-white p-2 ${className}`}>
      {label ? <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#5c6b7a]">{label}</p> : null}
      <svg ref={svgRef} className="block max-w-full" aria-label={`Barcode ${value}`} />
    </div>
  )
}
