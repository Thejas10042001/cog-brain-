import { GoogleGenAI } from "@google/genai";

export interface BrandingEvent {
  id: string;
  name: string;
  description: string;
  theme: string;
  date: string; // MM-DD
}

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
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${month}-${day}`;

    // Check static holidays
    const event = HOLIDAYS.find(h => h.date === todayStr);
    if (event) return event;

    // Optional: Use Gemini to detect local events if location is provided
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

    return null;
  }

  public async generateThemedLogo(event: BrandingEvent): Promise<string> {
    const cacheKey = `spiked_logo_${event.id}_${event.date}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    const prompt = `
      Create a high-quality, professional "Google Doodle" style variation of the "Spiked AI" brand logo.
      
      BRAND IDENTITY:
      - Name: SPIKED AI
      - Core Icon: A bold white exclamation mark "!" inside a rounded red square.
      - Colors: Primary Red (#DC2626), Dark Slate/Black (#0F172A).
      - Style: High-tech, Neural Sales Intelligence, Futuristic.

      THEME: ${event.name} - ${event.theme}
      
      INSTRUCTIONS:
      - Seamlessly integrate ${event.name} elements into the logo.
      - You can modify the "!" icon or the text "SPIKED AI" to reflect the theme.
      - Maintain the "SPIKED AI" legibility.
      - The output should be a single, clean, centered logo on a transparent or dark slate background.
      - Style should be artistic and creative, like a special edition commemorative logo.
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
