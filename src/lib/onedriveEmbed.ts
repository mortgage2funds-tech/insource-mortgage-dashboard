/**
 * Tiny helper that turns a normal OneDrive/SharePoint link
 * into an embeddable URL for an <iframe>.
 *
 * Use:
 *   <iframe src={toOneDriveEmbed(link)} />
 */

export function toOneDriveEmbed(link?: string | null): string {
  if (!link) return '';

  let url = link.trim();

  // If it's already an embed link, just return it
  if (/[\?&]embed(=true|=1|=2)?/.test(url) || url.includes('/embed')) {
    return url;
  }

  // Common OneDrive consumer links (onedrive.live.com) look like:
  // https://onedrive.live.com/?cid=...&id=...&resid=...&authkey=...&view=...
  // or
  // https://onedrive.live.com/view.aspx?resid=...&authkey=...
  if (url.includes('onedrive.live.com')) {
    // Convert .../view.aspx?...  ->  .../embed?...&em=2
    url = url.replace('/view.aspx?', '/embed?');

    // If it was the root form like onedrive.live.com/?id=..., add /embed
    if (url.endsWith('onedrive.live.com/') || url.includes('onedrive.live.com?')) {
      url = url.replace('onedrive.live.com?', 'onedrive.live.com/embed?');
    }

    // Ensure the em=2 param (needed for some docs)
    if (!/[?&]em=2(\b|&)/.test(url)) {
      url += (url.includes('?') ? '&' : '?') + 'em=2';
    }
    return url;
  }

  // SharePoint / Microsoft 365 business links often look like:
  // https://{tenant}.sharepoint.com/:w:/r/sites/.../Document.docx?d=...&web=1
  // Appending embed=true usually works for iframe
  if (url.includes('.sharepoint.com')) {
    if (url.includes('?')) {
      if (!/[?&]web=1(\b|&)/.test(url)) url += '&web=1';
      if (!/[?&]embed=true(\b|&)/.test(url)) url += '&embed=true';
    } else {
      url += '?web=1&embed=true';
    }
    return url;
  }

  // Fallback: return the original link
  return url;
}
