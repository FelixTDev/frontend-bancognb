import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "src", "assets", "images", "source");
const outputDir = path.join(root, "src", "assets", "images", "web");

const assets = [
  { name: "landing-hero", position: "centre" },
  { name: "security-threshold", position: "centre" },
  { name: "human-support", position: "centre" },
  { name: "service-architecture", position: "centre" },
  { name: "guided-empty-state", position: "centre" },
  { name: "personal-banking", position: "centre" },
  { name: "business-banking", position: "centre" },
];

const formats = [
  { suffix: "desktop", width: 1920, height: 1080 },
  { suffix: "tablet", width: 1280, height: 1024 },
  { suffix: "mobile", width: 780, height: 1040 },
];

await mkdir(outputDir, { recursive: true });
await Promise.all(
  assets.flatMap((asset) =>
    formats.map(async (format) => {
      await sharp(path.join(sourceDir, `${asset.name}.png`))
        .resize(format.width, format.height, {
          fit: "cover",
          position: asset.position,
        })
        .webp({ quality: 84, effort: 5 })
        .toFile(path.join(outputDir, `${asset.name}-${format.suffix}.webp`));
    }),
  ),
);
