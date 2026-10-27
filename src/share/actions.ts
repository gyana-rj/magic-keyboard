export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Copies text; falls back to a temporary textarea where the async clipboard API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export type ShareResult = 'shared' | 'cancelled' | 'failed';

/** Opens the OS share sheet, attaching the image where the platform allows it. */
export async function nativeShare(opts: { title: string; text: string; url: string; image?: File }): Promise<ShareResult> {
  const { title, text, url, image } = opts;
  try {
    if (image && navigator.canShare?.({ files: [image] })) {
      await navigator.share({ title, text: `${text} ${url}`, files: [image] });
    } else {
      await navigator.share({ title, text, url });
    }
    return 'shared';
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
