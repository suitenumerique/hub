import type { FilePreviewType } from '@gouvfr-lasuite/ui-kit';

import type { ChatDocument } from '@/features/drivers/types';

/** Adapts a `ChatDocument` to the shape consumed by the UI Kit `FilePreview`. */
export const documentToPreviewFile = (
  doc: ChatDocument,
): FilePreviewType => ({
  id: doc.id,
  title: doc.title,
  mimetype: doc.mimetype,
  size: doc.size ?? 0,
  url: doc.url ?? '',
  url_preview: doc.urlPreview ?? doc.url ?? '',
});
