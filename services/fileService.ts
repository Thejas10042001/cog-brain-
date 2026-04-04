
import { performVisionOcr } from './geminiService';
import { preprocessCanvas } from '../utils/imageUtils';

export interface ParsingCallbacks {
  onProgress?: (percent: number) => void;
  onStatusChange?: (isOcr: boolean) => void;
}

/**
 * Extracts raw text from a variety of document formats.
 * Includes intelligent fallback to high-precision OCR for scanned PDFs and images.
 */
export async function parseDocument(file: File, callbacks: ParsingCallbacks = {}): Promise<string> {
  const { onProgress, onStatusChange } = callbacks;

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    return extractTextFromPdf(arrayBuffer, onProgress, onStatusChange);
  } 
  
  if (file.type.startsWith('image/')) {
    onStatusChange?.(true);
    const text = await extractTextFromImage(file);
    onStatusChange?.(false);
    return text;
  } 
  
  if (file.name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } 

  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
    const arrayBuffer = await file.arrayBuffer();
    return extractTextFromExcel(arrayBuffer);
  }

  if (file.name.endsWith('.pptx')) {
    const arrayBuffer = await file.arrayBuffer();
    return extractTextFromPptx(arrayBuffer);
  }

  // Default: Plain text fallback
  const arrayBuffer = await file.arrayBuffer();
  return new TextDecoder().decode(arrayBuffer);
}

async function extractTextFromExcel(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = (window as any).XLSX;
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let fullText = "";
  
  workbook.SheetNames.forEach((sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to CSV for a readable text representation
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    fullText += `--- SHEET: ${sheetName} ---\n${csv}\n\n`;
  });
  
  return fullText;
}

async function extractTextFromPptx(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = (window as any).JSZip;
  const zip = await JSZip.loadAsync(arrayBuffer);
  let fullText = "";
  
  // PPTX slides are in ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
  
  // Sort slides numerically
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)![0]);
    const numB = parseInt(b.match(/\d+/)![0]);
    return numA - numB;
  });

  for (let i = 0; i < slideFiles.length; i++) {
    const slideXml = await zip.file(slideFiles[i])?.async('text');
    if (slideXml) {
      // Simple regex to extract text from <a:t> tags in the XML
      const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g);
      if (textMatches) {
        const slideText = textMatches.map(match => match.replace(/<a:t>|<\/a:t>/g, '')).join(' ');
        fullText += `--- SLIDE ${i + 1} ---\n${slideText}\n\n`;
      }
    }
  }
  
  return fullText;
}

async function extractTextFromPdf(
  arrayBuffer: ArrayBuffer, 
  onProgress?: (p: number) => void, 
  onStatusChange?: (isOcr: boolean) => void
): Promise<string> {
  const pdfjsLib = (window as any).pdfjsLib;
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";
  
  // Preliminary text extraction attempt
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
  }

  // If text density is low, trigger high-precision Cognitive OCR
  if (fullText.trim().length < 50 * pdf.numPages && pdf.numPages > 0) {
    onStatusChange?.(true);
    fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(Math.round((i / pdf.numPages) * 100));
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 4.0 }); // Ultra-HD 4.0x Scale
      const canvas = document.createElement('canvas');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ 
        canvasContext: canvas.getContext('2d'), 
        viewport 
      }).promise;
      
      preprocessCanvas(canvas);
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      const extractedText = await performVisionOcr(base64Data, 'image/png');
      fullText += `--- PAGE ${i} ---\n${extractedText}\n\n`;
    }
    onStatusChange?.(false);
    onProgress?.(0);
  }

  return fullText;
}

async function extractTextFromImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; 
        canvas.height = img.height;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        
        preprocessCanvas(canvas);
        const base64Data = canvas.toDataURL('image/png').split(',')[1];
        try {
          const text = await performVisionOcr(base64Data, 'image/png');
          resolve(text);
        } catch (err) { 
          reject(err); 
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
