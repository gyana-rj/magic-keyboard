const enc = encodeURIComponent;

/** Web-intent URLs for the share buttons (opened in a new tab; no SDKs or trackers). */
export function shareLinks(text: string, url: string) {
  return {
    x: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
  };
}
