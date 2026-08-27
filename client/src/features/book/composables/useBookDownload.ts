import { ref } from 'vue'
import { toast } from 'vue-sonner'

type ExportScope = 'primary' | 'all' | 'audio'

async function triggerBrowserDownload(url: string, filename?: string): Promise<void> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename ?? 'download'
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
}

export function useBookDownload() {
  const isDownloading = ref(false)

  async function downloadFile(fileId: number): Promise<void> {
    isDownloading.value = true
    try {
      await triggerBrowserDownload(`/api/v1/books/files/${fileId}/download`)
    } catch {
      toast.error('Download failed')
    } finally {
      isDownloading.value = false
    }
  }

  async function exportBooks(bookIds: number[], allFormats: boolean, scopeOverride?: ExportScope): Promise<void> {
    if (bookIds.length === 0) return
    const label = `${bookIds.length} book${bookIds.length === 1 ? '' : 's'}`
    const toastId = toast.loading(`Preparing ${label} for download...`)
    isDownloading.value = true
    try {
      const scope = scopeOverride ?? (allFormats ? 'all' : 'primary')
      const params = new URLSearchParams({
        bookIds: bookIds.join(','),
        scope,
      })
      toast.dismiss(toastId)
      await triggerBrowserDownload(`/api/v1/books/export/download?${params.toString()}`)
    } catch {
      toast.dismiss(toastId)
      toast.error('Export failed')
    } finally {
      isDownloading.value = false
    }
  }

  return { isDownloading, downloadFile, exportBooks }
}
