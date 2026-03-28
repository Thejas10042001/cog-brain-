import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const categorizeDocument = async (content: string, folders: { id: string, name: string }[]) => {
  const folderNames = folders.map(f => f.name).join(', ');
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following document content and categorize it into one of these folders: ${folderNames}. 
    Return ONLY the folder name that best matches the content. If none match, return "Miscellaneous".
    
    Document Content:
    ${content.substring(0, 5000)}`, // Limit content for analysis
    config: {
      temperature: 0.1,
      responseMimeType: "text/plain"
    }
  });

  const suggestedFolderName = response.text?.trim();
  const matchedFolder = folders.find(f => f.name.toLowerCase() === suggestedFolderName?.toLowerCase());
  
  return matchedFolder ? matchedFolder.id : folders.find(f => f.name === "Miscellaneous")?.id || null;
};
