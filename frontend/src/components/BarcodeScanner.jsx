import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Camera / USB scanner helper. USB wedge scanners type into the focused input;
 * camera mode uses html5-qrcode (EAN-13 + Code128 one-dimensional barcodes).
 */
export function BarcodeScanner({ onScan, onClose, label = 'Scan barcode', autoStart = true }) {
  const regionId = `barcode-scanner-${useId().replace(/:/g, '')}`
  const [mode, setMode] = useState('idle')
  const [manual, setManual] = useState('')
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')
  const html5Ref = useRef(null)
  const startingRef = useRef(false)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)

  onScanRef.current = onScan
  onCloseRef.current = onClose

  const stopCamera = useCallback(async () => {
    const scanner = html5Ref.current
    if (!scanner) return
    html5Ref.current = null
    try {
      await scanner.stop()
    } catch {
      /* already stopped */
    }
    try {
      scanner.clear()
    } catch {
      /* ignore */
    }
    setMode('idle')
  }, [])

  const startCamera = useCallback(async () => {
    if (startingRef.current || html5Ref.current) return
    startingRef.current = true
    setErr('')
    setStatus('Requesting camera permission…')
    setMode('starting')

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

      const scanner = new Html5Qrcode(regionId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
        useBarCodeDetectorIfSupported: true,
      })
      html5Ref.current = scanner

      const scanConfig = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.min(340, Math.floor(viewfinderWidth * 0.9))
          const height = Math.min(140, Math.floor(viewfinderHeight * 0.4))
          return { width: Math.max(width, 200), height: Math.max(height, 80) }
        },
      }

      const onSuccess = (decoded) => {
        const code = String(decoded || '').trim()
        if (!code) return
        setStatus(`Scanned: ${code}`)
        onScanRef.current?.(code)
        stopCamera()
        onCloseRef.current?.()
      }

      const tryStart = async (cameraIdOrConfig) => {
        await scanner.start(cameraIdOrConfig, scanConfig, onSuccess, () => {})
      }

      try {
        await tryStart({ facingMode: 'environment' })
      } catch {
        const cameras = await Html5Qrcode.getCameras()
        if (cameras?.length) {
          const back = cameras.find((c) => /back|rear|environment/i.test(c.label || ''))
          await tryStart((back || cameras[cameras.length - 1]).id)
        } else {
          await tryStart({ facingMode: 'user' })
        }
      }

      setMode('camera')
      setStatus('Place the barcode horizontally in the box. Hold steady for 2–3 seconds.')
    } catch (e) {
      const msg = e?.message || String(e)
      setErr(
        msg.includes('NotAllowed') || msg.includes('Permission')
          ? 'Camera blocked — allow camera access in the browser, or paste the code below.'
          : msg.includes('NotFound')
            ? 'No camera found — use manual entry below.'
            : msg || 'Camera unavailable — paste the barcode below.',
      )
      setMode('idle')
      setStatus('')
      html5Ref.current = null
    } finally {
      startingRef.current = false
    }
  }, [regionId, stopCamera])

  useEffect(() => {
    if (!autoStart) return undefined
    const timer = setTimeout(() => {
      startCamera()
    }, 200)
    return () => {
      clearTimeout(timer)
      stopCamera()
    }
  }, [autoStart, startCamera, stopCamera])

  function submitManual(e) {
    e.preventDefault()
    if (manual.trim()) {
      onScanRef.current?.(manual.trim())
      setManual('')
      onCloseRef.current?.()
    }
  }

  return (
    <div className="rounded-sm border border-[#e5e8eb] bg-[#fafafa] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-[#1a2b3c]">{label}</p>
        {onClose ? (
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={startCamera}
          disabled={mode === 'camera' || mode === 'starting'}
        >
          {mode === 'starting' ? 'Starting camera…' : mode === 'camera' ? 'Camera active' : 'Use camera'}
        </Button>
        {mode === 'camera' || mode === 'starting' ? (
          <Button type="button" size="sm" variant="secondary" onClick={stopCamera}>
            Stop camera
          </Button>
        ) : null}
      </div>
      {status ? <p className="mt-2 text-xs text-[#003366]">{status}</p> : null}
      {err ? <p className="mt-2 text-xs text-[#b42318]">{err}</p> : null}
      <div
        id={regionId}
        className="mt-3 min-h-[200px] max-w-md overflow-hidden rounded-sm bg-black/5"
      />
      <form onSubmit={submitManual} className="mt-3 flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or paste / USB scan into field…"
          className="flex-1 rounded-sm border border-[#e5e8eb] px-3 py-2 font-mono text-sm"
          autoFocus={!autoStart}
        />
        <Button type="submit" size="sm">
          Use
        </Button>
      </form>
      <p className="mt-2 text-[10px] leading-relaxed text-[#5c6b7a]">
        Camera scans printed barcodes (ISBN EAN-13, LIB Code128). Scanning a barcode on the same
        screen often fails — print the label or use another device. USB scanners: focus this field
        and scan.
      </p>
    </div>
  )
}
