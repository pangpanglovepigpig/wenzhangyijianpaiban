import { describe, expect, test, vi } from "vitest";
import { DOWNLOAD_SEQUENCE_DELAY_MS, downloadImagesSequentially } from "./downloadImages";

const images = [
  { id: "page-c", name: "xiaohongshu-note-01.png", url: "blob:page-1" },
  { id: "page-a", name: "xiaohongshu-note-02.png", url: "blob:page-2" },
  { id: "page-b", name: "xiaohongshu-note-03.png", url: "blob:page-3" },
];

describe("downloadImagesSequentially", () => {
  test("triggers images in their original order", async () => {
    const triggeredNames: string[] = [];

    await downloadImagesSequentially(images, undefined, {
      triggerDownload: (image) => triggeredNames.push(image.name),
      wait: async () => {},
    });

    expect(triggeredNames).toEqual([
      "xiaohongshu-note-01.png",
      "xiaohongshu-note-02.png",
      "xiaohongshu-note-03.png",
    ]);
  });

  test("waits between image triggers but not after the final image", async () => {
    const waits: number[] = [];

    await downloadImagesSequentially(images, undefined, {
      triggerDownload: () => {},
      wait: async (delayMs) => {
        waits.push(delayMs);
      },
    });

    expect(waits).toEqual([DOWNLOAD_SEQUENCE_DELAY_MS, DOWNLOAD_SEQUENCE_DELAY_MS]);
  });

  test("reports progress after each image is triggered", async () => {
    const progress: string[] = [];

    await downloadImagesSequentially(
      images,
      ({ current, total }) => {
        progress.push(`${current}/${total}`);
      },
      {
        triggerDownload: () => {},
        wait: async () => {},
      },
    );

    expect(progress).toEqual(["1/3", "2/3", "3/3"]);
  });

  test("does nothing for an empty image list", async () => {
    const triggerDownload = vi.fn();
    const reportProgress = vi.fn();
    const wait = vi.fn();

    await downloadImagesSequentially([], reportProgress, {
      triggerDownload,
      wait,
    });

    expect(triggerDownload).not.toHaveBeenCalled();
    expect(reportProgress).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
  });
});
