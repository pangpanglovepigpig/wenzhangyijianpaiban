export const DOWNLOAD_SEQUENCE_DELAY_MS = 900;

export type DownloadableImage = {
  name: string;
  url: string;
};

export type DownloadProgress = {
  current: number;
  total: number;
};

type SequentialDownloadOptions<TImage extends DownloadableImage> = {
  delayMs?: number;
  triggerDownload?: (image: TImage) => void;
  wait?: (delayMs: number) => Promise<void>;
};

export async function downloadImagesSequentially<TImage extends DownloadableImage>(
  images: TImage[],
  onProgress?: (progress: DownloadProgress) => void,
  options: SequentialDownloadOptions<TImage> = {},
) {
  const total = images.length;
  if (!total) return;

  const delayMs = options.delayMs ?? DOWNLOAD_SEQUENCE_DELAY_MS;
  const triggerDownload = options.triggerDownload ?? downloadImage;
  const wait = options.wait ?? waitForNextDownload;

  for (let index = 0; index < total; index += 1) {
    triggerDownload(images[index]);
    onProgress?.({ current: index + 1, total });

    if (index < total - 1) {
      await wait(delayMs);
    }
  }
}

export function waitForNextDownload(delayMs = DOWNLOAD_SEQUENCE_DELAY_MS) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

export function downloadImage(image: DownloadableImage) {
  const anchor = document.createElement("a");
  anchor.href = image.url;
  anchor.download = image.name;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
