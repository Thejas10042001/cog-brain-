import { GoogleGenAI } from "@google/genai";

export interface BrandingEvent {
  id: string;
  name: string;
  description: string;
  theme: string;
  date?: string; // MM-DD
}

const BRAND_CONSTRAINTS = `
1. CORE ICON: A bold white exclamation mark "!" inside a vibrant red square box (#dc2626).
2. TEXT: The word "SPIKED" in bold black serif font, followed by "AI" in bold red.
3. STYLE: Professional, clean, high-tech, yet creative (Google Doodle style).
4. PRESERVATION: The red square and "!" must remain the focal point.
5. THEME INTEGRATION: Elements of the event should wrap around, sit behind, or subtly modify the square without obscuring the "!".
`;

const HOLIDAYS: BrandingEvent[] = [
  { id: 'new-year', name: 'New Year', description: 'Celebrating the start of a new year', theme: 'fireworks, celebration, gold and red', date: '01-01' },
  { id: 'valentines', name: 'Valentines Day', description: 'Day of love', theme: 'hearts, pink and red, soft glow', date: '02-14' },
  { id: 'st-patricks', name: 'St. Patricks Day', description: 'Irish heritage', theme: 'shamrocks, green accents, gold coins', date: '03-17' },
  { id: 'earth-day', name: 'Earth Day', description: 'Environmental protection', theme: 'nature, leaves, green and blue', date: '04-22' },
  { id: 'halloween', name: 'Halloween', description: 'Spooky season', theme: 'pumpkins, ghosts, orange and black', date: '10-31' },
  { id: 'christmas', name: 'Christmas', description: 'Holiday season', theme: 'snow, pine trees, red and white', date: '12-25' },
  { id: 'anniversary', name: 'Spiked AI Anniversary', description: 'Celebrating our launch', theme: 'confetti, futuristic circuits, glowing red', date: '03-09' },
  { id: 'v3-launch', name: 'Neural Interface v3.1', description: 'Major system upgrade', theme: 'holographic data streams, matrix green accents, high-speed motion', date: '03-10' },
  { id: 'milestone-100k', name: '100K Intelligence Nodes', description: 'Reaching a major user milestone', theme: 'golden nodes, network expansion, celebratory glow', date: '03-15' },
];

export class BrandingService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  public async detectCurrentEvent(location?: string): Promise<BrandingEvent | null> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const todayStr = `${monthStr}-${dayStr}`;

    // 1. Check static holidays/milestones
    const event = HOLIDAYS.find(h => h.date === todayStr);
    if (event) return event;

    // 2. Optional: Use Gemini to detect local events if location is provided
    if (location) {
      try {
        const response = await this.ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Given the date ${now.toDateString()} and location ${location}, identify if there is any major cultural event or holiday happening today. Return a JSON object with: { "id": string, "name": string, "description": string, "theme": string } or null if nothing significant.`,
          config: { responseMimeType: "application/json" }
        });
        
        const data = JSON.parse(response.text);
        if (data && data.name) return { ...data, date: todayStr };
      } catch (e) {
        console.error("Failed to detect local event:", e);
      }
    }

    // 3. Seasonal Fallbacks
    if (month >= 3 && month <= 5) {
      return { id: 'spring', name: 'Spring Growth', description: 'Spring Growth & Renewal', theme: 'digital leaves, blooming circuits, soft green' };
    } else if (month >= 6 && month <= 8) {
      return { id: 'summer', name: 'Summer Energy', description: 'Summer Energy & Heat', theme: 'vibrant sunbeams, solar flares, warm orange' };
    } else if (month >= 9 && month <= 11) {
      return { id: 'autumn', name: 'Autumn Harvest', description: 'Autumn Harvest & Data Collection', theme: 'falling data bits, golden leaves, rustic orange' };
    } else {
      return { id: 'winter', name: 'Winter Focus', description: 'Winter Focus & Clarity', theme: 'frosty circuits, ice crystals, cool blue' };
    }
  }

  public async generateThemedLogo(event: BrandingEvent): Promise<string> {
    const dateStr = new Date().toISOString().split('T')[0];
    const cacheKey = `spiked_logo_${event.id}_${dateStr}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    const prompt = `
      Design a "Spiked AI" Google Doodle style variation for today's theme: ${event.name}.
      
      BRAND RULES & CONSTRAINTS:
      ${BRAND_CONSTRAINTS}
      
      TASK:
      Create a high-quality, professional logo variation for "Spiked AI". 
      The core icon (Red square with white "!") should be themed with ${event.name} elements (${event.theme}).
      For example, if it's Winter, add subtle frost or snow to the square. 
      If it's Spring, add small digital leaves or flowers.
      The text "SPIKED AI" should be integrated into the composition.
      
      Output should be a clean, modern digital illustration on a transparent or dark slate background.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          localStorage.setItem(cacheKey, imageUrl);
          return imageUrl;
        }
      }
    } catch (e) {
      console.error("Logo generation failed:", e);
    }

    return '';
  }
}

export const brandingService = new BrandingService();
