/**
 * Gemini API Client
 * Wraps Google's Generative AI SDK
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiClient {
  private client: GoogleGenerativeAI;
  private model: any;
  private timeout: number;

  constructor(apiKey: string, timeout: number = 30000) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    this.timeout = timeout;
  }

  /**
   * Generate content with timeout and retry logic
   */
  async generateContent(
    prompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      retries?: number;
    } = {}
  ): Promise<string> {
    const { temperature = 0.7, maxTokens = 8192, retries = 3 } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await Promise.race([
          this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
          this.createTimeoutPromise(),
        ]);

        const response = await result.response;
        return response.text();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Exponential backoff
        if (attempt < retries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to generate content after retries');
  }

  /**
   * Generate JSON content with schema validation
   */
  async generateJSON<T>(
    prompt: string,
    _schema: Record<string, unknown>,
    options?: { temperature?: number; retries?: number }
  ): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No markdown, no explanations, just JSON.`;

    const response = await this.generateContent(jsonPrompt, {
      temperature: options?.temperature ?? 0.3, // Lower temperature for structured output
      maxTokens: 4096,
      retries: options?.retries ?? 3,
    });

    // Extract JSON from response (handle markdown code blocks)
    let jsonString = response.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${(error as Error).message}`);
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // API key errors, rate limits, etc.
      return error.message.includes('API_KEY') || 
             error.message.includes('PERMISSION_DENIED') ||
             error.message.includes('INVALID_ARGUMENT');
    }
    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

