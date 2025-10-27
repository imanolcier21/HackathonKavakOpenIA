import BaseAgent from '../core/BaseAgent.js';
import config from '../config/index.js';

/**
 * Model 8: Flashcard Generator
 * Creates flashcards for spaced repetition learning
 * Uses o1-mini (GPT-thinking medium) for better flashcard generation
 */
export class FlashcardGenerator extends BaseAgent {
  constructor() {
    super({
      name: 'FlashcardGenerator',
      model: 'gpt-4o', // Using GPT-4o for better JSON structured output
      temperature: 0.7, // Some creativity but still structured
      maxTokens: 4000,
      systemPrompt: `You are an expert educational flashcard creator. You MUST respond with ONLY valid JSON, no other text.`,
    });
  }

  /**
   * @param {import('../types/index.js').AgentMessage} message
   * @returns {Promise<import('../types/index.js').AgentResponse>}
   */
  async processMessage(message) {
    try {
      switch (message.type) {
        case 'request':
          return await this.handleRequest(message);
        default:
          return this.createResponse(null, 'Unsupported message type');
      }
    } catch (error) {
      return this.createResponse(null, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle request messages
   * @private
   */
  async handleRequest(message) {
    const { action, data } = message.content;

    switch (action) {
      case 'teach':
        return await this.generateFlashcards(data);
      default:
        return this.createResponse(null, 'Unsupported action');
    }
  }

  /**
   * Generate flashcards for the lesson content
   * @private
   */
  async generateFlashcards(data) {
    const { 
      userId, 
      userMessage, 
      lessonContext, 
      conversationHistory = [],
      systemPromptContent = '',
      userPreferences = {}
    } = data;

    // Detect if this is an initial lesson explanation
    const isInitialExplanation = conversationHistory.length === 0 && 
                                  userMessage.includes('Please provide a complete, comprehensive explanation');

    // Build context from conversation history
    const historyContext = conversationHistory
      .slice(-6)
      .map(msg => `${msg.is_user ? 'Student' : 'Teacher'}: ${msg.message}`)
      .join('\n');

    const flashcardPrompt = `Create ${isInitialExplanation ? '8-12' : '5-8'} educational flashcards for spaced repetition learning.

LESSON CONTEXT:
Topic: ${lessonContext.topic || 'General'}
Lesson: ${lessonContext.title || 'Introduction'}
Description: ${lessonContext.description || 'Not provided'}

${historyContext ? `CONVERSATION HISTORY:\n${historyContext}\n` : ''}

STUDENT QUESTION: ${userMessage}

${systemPromptContent ? `STUDENT PREFERENCES:\n${systemPromptContent}\n` : ''}

REQUIREMENTS:
- Create ${isInitialExplanation ? '8-12 comprehensive cards covering ALL major concepts' : '5-8 focused cards answering the question'}
- Each card should test ONE specific concept
- Use clear questions and complete answers
- Include difficulty level (easy/medium/hard)
- Add relevant tags for categorization
- Optionally add hints, mnemonics, or examples

CRITICAL: Respond with ONLY the JSON object below. No markdown, no code blocks, no explanations - JUST the raw JSON.

{
  "topic": "${lessonContext.title || 'Topic'}",
  "subtopic": "Specific aspect covered",
  "totalCards": ${isInitialExplanation ? '10' : '6'},
  "flashcards": [
    {
      "id": 1,
      "front": "Question or prompt",
      "back": "Complete answer with explanation",
      "difficulty": "easy",
      "tags": ["tag1", "tag2"],
      "hint": "Optional hint",
      "mnemonic": null,
      "example": "Optional example"
    }
  ],
  "studyTips": ["Tip 1", "Tip 2", "Tip 3"],
  "reviewSchedule": "Review after: 1 day, 3 days, 7 days, 14 days, 30 days"
}`;

    try {
      const response = await this.llm.invoke(flashcardPrompt);
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      console.log('🃏 [FlashcardGenerator] Raw LLM Response:');
      console.log(content.substring(0, 500));
      console.log('...');

      // Try to extract JSON
      let flashcardSet;
      try {
        flashcardSet = this.extractJSON(content);
        console.log('✅ [FlashcardGenerator] Successfully parsed JSON with', flashcardSet.flashcards?.length || 0, 'cards');
      } catch (jsonError) {
        // If JSON extraction fails, create a simple flashcard from the content
        console.error('❌ [FlashcardGenerator] Failed to parse flashcards as JSON');
        console.error('Error:', jsonError.message);
        console.error('Full response:', content);
        
        flashcardSet = {
          topic: lessonContext.title || 'General Topic',
          subtopic: userMessage.substring(0, 50),
          totalCards: 1,
          flashcards: [{
            id: 1,
            front: userMessage,
            back: content.substring(0, 300),
            difficulty: "medium",
            tags: ["general"],
            hint: "Think about the key concepts",
            mnemonic: null,
            example: null
          }],
          studyTips: ["Review regularly", "Use spaced repetition"],
          reviewSchedule: "Review in 1 day, 3 days, 7 days, 14 days"
        };
      }

      // Ensure all flashcards have IDs
      if (flashcardSet.flashcards) {
        flashcardSet.flashcards = flashcardSet.flashcards.map((card, idx) => ({
          ...card,
          id: card.id || idx + 1
        }));
        flashcardSet.totalCards = flashcardSet.flashcards.length;
      }

      return this.createResponse({
        response: flashcardSet,
        responseType: 'flashcards',
        message: 'Flashcards generated successfully',
      });

    } catch (error) {
      console.error('Error generating flashcards:', error);
      return this.createResponse(
        null,
        `Failed to generate flashcards: ${error.message}`
      );
    }
  }

  /**
   * Extract JSON from text
   * @private
   */
  extractJSON(text) {
    // First, try direct JSON parse
    try {
      return JSON.parse(text);
    } catch (e) {
      // Continue to other methods
    }

    // Try to extract from markdown code blocks
    const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
    const codeBlockMatch = text.match(codeBlockRegex);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        console.warn('Failed to parse JSON from code block:', e.message);
      }
    }

    // Try to find JSON object anywhere in the text
    const jsonObjectRegex = /\{[\s\S]*"flashcards"[\s\S]*\}/;
    const objectMatch = text.match(jsonObjectRegex);
    if (objectMatch) {
      try {
        // Clean up common issues
        let jsonStr = objectMatch[0];
        // Remove trailing commas before closing braces/brackets
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse cleaned JSON object:', e.message);
      }
    }

    // Last resort: try to find any JSON object
    const anyObjectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/;
    const anyMatch = text.match(anyObjectRegex);
    if (anyMatch) {
      try {
        return JSON.parse(anyMatch[0]);
      } catch (e) {
        console.warn('Failed to parse any JSON object:', e.message);
      }
    }
    
    throw new Error('No valid JSON found in response');
  }
}

export default FlashcardGenerator;
