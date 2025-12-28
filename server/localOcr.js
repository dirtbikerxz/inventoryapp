const { createWorker } = require("tesseract.js");
const fs = require("fs");
const https = require("https");
const path = require("path");

let workerPromise = null;

function fetchWithRedirect(url, dest, logger, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Handle redirects manually to avoid 30x failures
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        if (redirects > 5) {
          return reject(
            new Error(`Too many redirects fetching eng.traineddata from ${url}`),
          );
        }
        const nextUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        logger?.info?.(`Following redirect to ${nextUrl}`);
        res.destroy();
        return resolve(fetchWithRedirect(nextUrl, dest, logger, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(
          new Error(`Failed to download eng.traineddata (${res.statusCode})`),
        );
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    });
    req.on("error", reject);
  });
}

async function downloadModel(dest, logger) {
  const url =
    process.env.TESSERACT_MODEL_URL ||
    "https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata";
  await fetchWithRedirect(url, dest, logger);
  logger?.info?.("Downloaded eng.traineddata for local OCR");
}

async function ensureModel(langPath, logger) {
  const target = path.join(langPath, "eng.traineddata");
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(langPath, { recursive: true });
  await downloadModel(target, logger);
  return target;
}

async function getWorker(logger) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const langPath =
        process.env.TESSERACT_LANG_PATH ||
        process.env.TESSDATA_PREFIX ||
        path.join(__dirname, "..", "data", "tessdata");
      await ensureModel(langPath, logger);
      // Explicit language selection; keep as string to satisfy tesseract internals.
      const langStr = "eng";
      const worker = await createWorker({
        langPath,
      });
      await worker.loadLanguage(langStr);
      await worker.initialize(langStr);
      return worker;
    })();
  }
  return workerPromise;
}

async function ocrImage(buffer, logger) {
  try {
    const worker = await getWorker(logger);
    const { data } = await worker.recognize(buffer);
    return data?.text || "";
  } catch (err) {
    logger?.warn?.(err, "Local OCR failed; continuing without OCR");
    return "";
  }
}

module.exports = { ocrImage };
