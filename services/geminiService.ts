import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface GeneratedImage {
  id: string;
  src: string;
  prompt: string;
  createdAt: string;
}

const enhancePrompt = (prompt: string): string => {
  const quality = "ACES (cinema-grade color science), 8K HDR, ultra-detailed, high-fidelity, professional-grade, photorealistic";
  const negativePrompt = "Negative prompt: poorly drawn face, mutation, mutated, extra limb, ugly, disgusting, poorly drawn hands, missing limb, floating limbs, disconnected limbs, malformed hands, blurry, mutated hands and fingers, watermarked, oversaturated, distorted, deformed, childish, cartoonish, low-resolution, artifacts, noise, bad anatomy, jpeg artifacts, signature.";
  return `${prompt}, ${quality}. ${negativePrompt}`;
};

export const generateImage = async (
  prompt: string,
  referenceImage: { data: string; mimeType: string } | null,
): Promise<string> => {
  const finalPrompt = enhancePrompt(prompt);

  try {
    if (referenceImage) {
      // Use gemini-2.5-flash-image for editing/image-to-image
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        // Fix: 'contents' for a single-turn multimodal request should be an object with a 'parts' array, not an array of Content objects.
        contents: {
          parts: [
            {
              inlineData: {
                data: referenceImage.data,
                mimeType: referenceImage.mimeType,
              },
            },
            { text: finalPrompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
      }
      throw new Error("Image editing did not return an image.");
    } else {
      // Use imagen-4.0-generate-001 for text-to-image
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: finalPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
      } else {
        throw new Error("No image was generated.");
      }
    }
  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('deadline')) {
            throw new Error("The request timed out. Please try again.");
        }
        if (error.message.includes('API key')) {
            throw new Error("Invalid API Key. Please check your configuration.");
        }
    }
    throw new Error("Failed to connect to the AI service. The model may be overloaded or down.");
  }
};