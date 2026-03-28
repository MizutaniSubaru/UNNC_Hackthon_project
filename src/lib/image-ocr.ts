type TesseractModule = typeof import('tesseract.js');
type OcrWorker = Awaited<ReturnType<TesseractModule['createWorker']>>;

let tesseractModulePromise: Promise<TesseractModule> | null = null;
let ocrWorkerPromise: Promise<OcrWorker> | null = null;
let ocrWorkerLanguage: string | null = null;

function ensureBrowserApi(name: string, value: unknown) {
  if (!value) {
    throw new Error(`${name} is not available in this browser.`);
  }
}

async function loadTesseractModule() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import('tesseract.js').then((module) => {
      const resolvedModule = ('default' in module ? module.default : module) as TesseractModule;
      resolvedModule.setLogging(false);
      return resolvedModule;
    });
  }

  return tesseractModulePromise;
}

async function getOcrWorker(language: string) {
  const tesseract = await loadTesseractModule();

  if (!ocrWorkerPromise) {
    ocrWorkerLanguage = language;
    ocrWorkerPromise = tesseract.createWorker(language).catch((error) => {
      ocrWorkerPromise = null;
      ocrWorkerLanguage = null;
      throw error;
    });
    return ocrWorkerPromise;
  }

  const worker = await ocrWorkerPromise;
  if (ocrWorkerLanguage !== language) {
    await worker.reinitialize(language);
    ocrWorkerLanguage = language;
  }

  return worker;
}

export function resolveOcrLanguage(locale: string) {
  return locale.startsWith('zh') ? 'chi_sim+eng' : 'eng+chi_sim';
}

export function normalizeOcrText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export async function convertImageFileToDataUrl(file: Blob) {
  ensureBrowserApi('FileReader', typeof FileReader !== 'undefined');

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read the selected image.'));
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to encode the selected image.'));
    };

    reader.readAsDataURL(file);
  });
}

export async function recognizeImageText(input: {
  dataUrl: string;
  locale: string;
}) {
  const worker = await getOcrWorker(resolveOcrLanguage(input.locale));
  const result = await worker.recognize(input.dataUrl);
  return normalizeOcrText(result.data.text);
}

export async function terminateImageOcrWorker() {
  if (!ocrWorkerPromise) {
    return;
  }

  const worker = await ocrWorkerPromise.catch(() => null);
  ocrWorkerPromise = null;
  ocrWorkerLanguage = null;

  await worker?.terminate();
}
