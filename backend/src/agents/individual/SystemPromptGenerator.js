import BaseAgent from '../core/BaseAgent.js';
import config from '../config/index.js';
import pool from '../../config/database.js';

/**
 * Model 2: System Prompt Creator & Preference Manager
 * Generates and updates system prompts for Model 4 and Model 5
 * Manages global user preferences with update/removal capabilities
 * Uses GPT-4o for intelligent preference detection and management
 */
export class SystemPromptGenerator extends BaseAgent {
  constructor() {
    super({
      name: 'SystemPromptGenerator',
      model: 'gpt-5', // Using GPT-5 (gpt5 equivalent) for preference analysis
      reasoning: {
        "effort": "high"
      },
      maxTokens: 2000,
      systemPrompt: `You are an expert preference analyzer and system prompt creator for educational AI.

Your responsibilities:
1. Analyze user messages to detect preference changes
2. Update global preferences (format, style, complexity)
3. Remove outdated/conflicting preferences
4. Generate personalized system prompts for teaching models

Key capabilities:
- Detect explicit preferences: "I hate text, use flashcards", "I prefer videos"
- Detect implicit preferences from learning patterns
- Remove outdated preferences when user changes mind
- Maintain preference history and reasoning`,
    });
    
    /** @type {Map<string, any>} */
    this.userPreferences = new Map(); // Cache user preferences
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
        case 'notification':
          return await this.handleNotification(message);
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
      case 'generate_system_prompt':
      case 'generate_personalized_prompt': // Support both action names
        return await this.generateSystemPrompt(data);
      case 'update_system_prompt':
        return await this.updateSystemPrompt(data);
      case 'analyze_preferences':
        return await this.analyzeAndUpdatePreferences(data);
      default:
        return this.createResponse(null, 'Unsupported action');
    }
  }

  /**
   * Analyze user message and update global preferences
   * Detects new preferences, updates existing ones, removes outdated ones
   * @private
   */
  async analyzeAndUpdatePreferences(data) {
    const { userId, userMessage, userPreferences = {}, conversationHistory = [] } = data;

    console.log(`🔍 [Model 2] Analyzing preferences for user ${userId}...`);

    // Get current stored preferences
    let currentPrefs = await this.getUserPreferences(userId);

    const analysisPrompt = `You are analyzing a user's message to update their learning preferences.

CURRENT USER PREFERENCES:
${JSON.stringify(currentPrefs, null, 2)}

USER'S LATEST MESSAGE:
"${userMessage}"

RECENT CONVERSATION HISTORY:
${conversationHistory.slice(-3).map(msg => `${msg.is_user ? 'Student' : 'Teacher'}: ${msg.message}`).join('\n')}

TASK:
1. Detect if the user is expressing a NEW preference or CHANGING an existing one
2. Identify which preferences to UPDATE or REMOVE
3. Determine the preferred output format (text/video/flashcards)

PREFERENCE DETECTION RULES:

**Explicit Format Preferences** (HIGH PRIORITY - SAVE GLOBALLY):
- "I hate text" / "too much text" / "no text" → MUST set formatPreference to "flashcards" (NOT text)
- "I hate flashcards" → Set formatPreference to "video" or "text"
- "I hate videos" / "no videos" → Set formatPreference to "flashcards" or "text"
- "use flashcards" / "give me flashcards" → formatPreference = "flashcards"
- "I prefer videos" / "make a video" → formatPreference = "video"
- "explain in text" / "write it out" → formatPreference = "text"

**CRITICAL RULE**: When user says they HATE a format, NEVER return that format as preferredFormat. Choose an alternative:
- If they hate text → Choose "flashcards" or "video" (prefer flashcards)
- If they hate flashcards → Choose "video" or "text" (prefer video)
- If they hate videos → Choose "flashcards" or "text" (prefer flashcards)

**Changing Preferences** (REMOVE OLD, SET NEW):
- "No, I like X better" → removePreferences: [old format], set new formatPreference
- "Actually, I prefer Y" → Remove conflicting preferences, set new one
- "Change to Z" → Update to new preference

**Additional Preference Types**:
- "always give examples" → wants_examples = true
- "I don't need examples" → wants_examples = false
- "use analogies" → wants_analogies = true
- "I learn better with exercises" → wants_exercises = true

**Implicit Preferences**:
- Asking "summarize" / "key points" → Suggest flashcards
- Asking "show me" / "demonstrate" → Suggest video
- Asking "explain in detail" → Suggest text

**Learning Style Detection**:
- Visual language ("show", "see", "picture") → learning_style = "visual"
- "I like to hear" / "read aloud" → learning_style = "auditory"  
- "I prefer to read" → learning_style = "reading_writing"
- "hands-on" → learning_style = "kinesthetic"

RESPONSE FORMAT (JSON only):
{
  "preferencesChanged": boolean,
  "updates": {
    "formatPreference": "text|video|flashcards|null",
    "explanation_style": "concise|detailed|balanced|null",
    "learningStyle": "visual|auditory|reading_writing|kinesthetic|mixed|null",
    "pace": "slow|normal|fast|null",
    "complexity": "beginner|intermediate|advanced|null",
    "wants_examples": boolean or null,
    "wants_analogies": boolean or null,
    "wants_exercises": boolean or null,
    "removePreferences": ["list", "of", "outdated", "preference", "field", "names"]
  },
  "reasoning": "Why these changes were made",
  "preferredFormat": "text|video|flashcards",
  "confidence": number (0-100),
  "indicators": ["specific evidence from message"]
}

If NO preference changes detected, set preferencesChanged to false and return current format.`;

    try {
      const response = await this.llm.invoke(analysisPrompt);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const analysis = this.extractJSON(content);

      console.log(`📊 [Model 2] Preference analysis (raw):`, {
        changed: analysis.preferencesChanged,
        format: analysis.preferredFormat,
        confidence: analysis.confidence
      });

      // ENHANCED VALIDATION: Intelligently detect format preferences
      let preferredFormat = analysis.preferredFormat || currentPrefs.formatPreference || 'text';
      let preferencesChanged = analysis.preferencesChanged || false;
      const updates = analysis.updates || {};
      
      const lowerMessage = userMessage.toLowerCase();
      
      // Detect explicit format preferences with high accuracy
      const formatKeywords = {
        flashcards: ['flashcard', 'flash card', 'cards', 'quiz me', 'test me', 'memorize'],
        video: ['video', 'visual', 'show me', 'watch', 'demonstration', 'demo'],
        text: ['text', 'read', 'written', 'write it', 'explain in writing', 'article']
      };
      
      // Check for "I like/prefer/want X" patterns
      const likePatterns = ['i like', 'i prefer', 'i want', 'give me', 'use', 'show me', 'make'];
      const hatePatterns = ['i hate', 'no', "don't", 'not', 'avoid', 'dislike'];
      
      // Detect positive preferences (I like flashcards)
      for (const pattern of likePatterns) {
        if (lowerMessage.includes(pattern)) {
          for (const [format, keywords] of Object.entries(formatKeywords)) {
            for (const keyword of keywords) {
              if (lowerMessage.includes(keyword)) {
                preferredFormat = format;
                updates.formatPreference = format;
                preferencesChanged = true;
                console.log(`✅ [Model 2] Detected explicit preference: "${pattern} ${keyword}" → ${format}`);
                break;
              }
            }
          }
        }
      }
      
      // Detect negative preferences (I hate text)
      for (const pattern of hatePatterns) {
        if (lowerMessage.includes(pattern)) {
          for (const [format, keywords] of Object.entries(formatKeywords)) {
            for (const keyword of keywords) {
              if (lowerMessage.includes(keyword)) {
                // User hates this format, choose an alternative
                const alternatives = {
                  text: 'flashcards',
                  flashcards: 'video',
                  video: 'flashcards'
                };
                preferredFormat = alternatives[format];
                updates.formatPreference = alternatives[format];
                preferencesChanged = true;
                console.log(`⚠️ [Model 2] User hates ${format}, switching to ${alternatives[format]}`);
                break;
              }
            }
          }
        }
      }
      
      // Additional legacy hate expression checks (already have lowerMessage defined above)
      if (lowerMessage.includes('hate text') || lowerMessage.includes('too much text')) {
        if (preferredFormat === 'text') {
          preferredFormat = 'flashcards'; // Default to flashcards when hating text
          console.log('⚠️ [Model 2] Legacy check: User hates text, forcing format to flashcards');
          updates.formatPreference = 'flashcards';
          preferencesChanged = true;
        }
      }
      if (lowerMessage.includes('hate flashcard')) {
        if (preferredFormat === 'flashcards') {
          preferredFormat = 'video';
          console.log('⚠️ [Model 2] Legacy check: User hates flashcards, forcing format to video');
          updates.formatPreference = 'video';
          preferencesChanged = true;          analysis.updates.formatPreference = 'video';
          preferencesChanged = true;
        }
      }
      if (lowerMessage.includes('hate video')) {
        if (preferredFormat === 'video') {
          preferredFormat = 'flashcards';
          console.log('⚠️ [Model 2] Legacy check: User hates videos, forcing format to flashcards');
          updates.formatPreference = 'flashcards';
          preferencesChanged = true;
        }
      }

      // Update preferences if changed (use our enhanced detection)
      if (preferencesChanged) {
        currentPrefs = await this.updateUserPreferences(userId, updates, currentPrefs);
        console.log(`✅ [Model 2] Preferences updated for user ${userId} → ${preferredFormat}`);
      }

      return this.createResponse({
        formatAnalysis: {
          preferredFormat,
          confidence: analysis.confidence || 90, // Higher confidence with enhanced detection
          reasoning: analysis.reasoning || `Detected from keywords in user message`,
          indicators: analysis.indicators || [],
          preferencesUpdated: preferencesChanged,
          currentPreferences: currentPrefs
        }
      });

    } catch (error) {
      console.error('Error analyzing preferences:', error);
      
      // Fallback to current preferences
      return this.createResponse({
        formatAnalysis: {
          preferredFormat: currentPrefs.formatPreference || 'text',
          confidence: 50,
          reasoning: 'Using stored preferences (analysis failed)',
          indicators: [],
          preferencesUpdated: false,
          currentPreferences: currentPrefs
        }
      });
    }
  }

  /**
   * Get user preferences from database
   * @private
   */
  async getUserPreferences(userId) {
    try {
      // Check cache first
      if (this.userPreferences.has(userId)) {
        const cached = this.userPreferences.get(userId);
        console.log(`📦 [Model 2] Using cached preferences for user ${userId}:`, {
          format: cached.formatPreference,
          explanationStyle: cached.explanationStyle
        });
        return cached;
      }

      const result = await pool.query(
        `SELECT learning_style, pace, preferred_difficulty, explanation_style, 
                wants_examples, wants_analogies, wants_exercises, custom_preferences 
         FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const customPrefs = row.custom_preferences || {};
        
        const prefs = {
          learningStyle: row.learning_style,
          pace: row.pace,
          complexity: row.preferred_difficulty,
          explanationStyle: row.explanation_style || 'balanced', // concise/detailed/balanced
          formatPreference: customPrefs.formatPreference || customPrefs.output_format || 'text', // text/video/flashcards - from custom_preferences
          wants_examples: row.wants_examples,
          wants_analogies: row.wants_analogies,
          wants_exercises: row.wants_exercises,
          custom: customPrefs
        };
        
        console.log(`💾 [Model 2] Loaded preferences from DB for user ${userId}:`, {
          format: prefs.formatPreference,
          explanationStyle: prefs.explanationStyle,
          pace: prefs.pace,
          customPrefs: customPrefs
        });
        
        // Cache it
        this.userPreferences.set(userId, prefs);
        return prefs;
      }

      // Default preferences - create entry if doesn't exist
      console.log(`🆕 [Model 2] Creating default preferences for user ${userId}`);
      await pool.query(
        `INSERT INTO user_preferences (user_id, learning_style, pace, preferred_difficulty, explanation_style, wants_examples, wants_analogies, wants_exercises, custom_preferences)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, 'mixed', 'normal', 'intermediate', 'balanced', true, true, true, JSON.stringify({ formatPreference: 'text', output_format: 'text' })]
      );

      const defaultPrefs = {
        learningStyle: 'mixed',
        pace: 'normal',
        complexity: 'intermediate',
        explanationStyle: 'balanced',
        formatPreference: 'text', // Default output format from custom_preferences
        wants_examples: true,
        wants_analogies: true,
        wants_exercises: true,
        custom: { formatPreference: 'text', output_format: 'text' }
      };

      this.userPreferences.set(userId, defaultPrefs);
      return defaultPrefs;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {
        learningStyle: 'mixed',
        pace: 'normal',
        complexity: 'intermediate',
        explanationStyle: 'balanced',
        formatPreference: 'text',
        wants_examples: true,
        wants_analogies: true,
        wants_exercises: true,
        custom: { formatPreference: 'text', output_format: 'text' }
      };
    }
  }

  /**
   * Update user preferences in database
   * @private
   */
  async updateUserPreferences(userId, updates, currentPrefs) {
    try {
      const newPrefs = { ...currentPrefs };
      const customPrefs = { ...currentPrefs.custom };

      // Apply updates - ALL custom preferences go into custom_preferences JSONB field
      if (updates.formatPreference !== null && updates.formatPreference !== undefined) {
        // formatPreference is the output format: text/video/flashcards - store in custom_preferences
        newPrefs.formatPreference = updates.formatPreference;
        customPrefs.formatPreference = updates.formatPreference;
        customPrefs.output_format = updates.formatPreference; // Keep both for backwards compatibility
      }
      if (updates.explanation_style !== null && updates.explanation_style !== undefined) {
        // explanation_style is concise/detailed/balanced - stored in explanation_style column
        newPrefs.explanationStyle = updates.explanation_style;
      }
      if (updates.learningStyle !== null && updates.learningStyle !== undefined) {
        newPrefs.learningStyle = updates.learningStyle;
      }
      if (updates.pace !== null && updates.pace !== undefined) {
        newPrefs.pace = updates.pace;
      }
      if (updates.complexity !== null && updates.complexity !== undefined) {
        newPrefs.complexity = updates.complexity;
      }
      if (updates.wants_examples !== null && updates.wants_examples !== undefined) {
        newPrefs.wants_examples = updates.wants_examples;
      }
      if (updates.wants_analogies !== null && updates.wants_analogies !== undefined) {
        newPrefs.wants_analogies = updates.wants_analogies;
      }
      if (updates.wants_exercises !== null && updates.wants_exercises !== undefined) {
        newPrefs.wants_exercises = updates.wants_exercises;
      }

      // Remove outdated preferences if specified
      if (updates.removePreferences && Array.isArray(updates.removePreferences)) {
        updates.removePreferences.forEach(pref => {
          if (pref === 'formatPreference' || pref === 'output_format') {
            newPrefs.formatPreference = 'text';
            customPrefs.output_format = 'text';
          }
          if (pref === 'explanation_style') {
            newPrefs.explanationStyle = 'balanced';
          }
          if (pref === 'learningStyle') newPrefs.learningStyle = 'mixed';
          if (pref === 'pace') newPrefs.pace = 'normal';
          if (pref === 'complexity') newPrefs.complexity = 'intermediate';
          if (pref === 'wants_examples') newPrefs.wants_examples = true;
          if (pref === 'wants_analogies') newPrefs.wants_analogies = true;
          if (pref === 'wants_exercises') newPrefs.wants_exercises = true;
        });
      }

      // Update custom preferences
      newPrefs.custom = customPrefs;

      // Update database - use user_preferences table
      await pool.query(
        `UPDATE user_preferences 
         SET learning_style = $1, 
             pace = $2, 
             preferred_difficulty = $3, 
             explanation_style = $4,
             wants_examples = $5,
             wants_analogies = $6,
             wants_exercises = $7,
             custom_preferences = $8,
             preference_changes_count = preference_changes_count + 1
         WHERE user_id = $9`,
        [
          newPrefs.learningStyle, 
          newPrefs.pace, 
          newPrefs.complexity, 
          newPrefs.explanationStyle || 'balanced',
          newPrefs.wants_examples,
          newPrefs.wants_analogies,
          newPrefs.wants_exercises,
          JSON.stringify(customPrefs),
          userId
        ]
      );

      // Update cache
      this.userPreferences.set(userId, newPrefs);

      console.log(`💾 [Model 2] Saved preferences to user_preferences table:`, newPrefs);

      return newPrefs;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return currentPrefs;
    }
  }

  /**
   * Extract JSON from text
   * @private
   */
  extractJSON(text) {
    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      
      throw new Error('No valid JSON found in response');
    }
  }

  /**
   * Handle notification messages
   * @private
   */
  async handleNotification(message) {
    const { event, data } = message.content;

    switch (event) {
      case 'feedback_received':
        return await this.incorporateFeedback(data);
      case 'learning_pattern_detected':
        return await this.adaptToLearningPattern(data);
      default:
        return this.createResponse({ acknowledged: true });
    }
  }

  /**
   * Generate initial system prompt with user preferences
   * @private
   */
  async generateSystemPrompt(data) {
    const { userId, userPreferences = {}, lessonContext = {}, targetModel = 'teacher' } = data;

    // Get latest preferences from database
    const currentPrefs = await this.getUserPreferences(userId);

    const lessonTitle = lessonContext?.title || 'General Learning Topic';
    const lessonTopic = lessonContext?.topic || 'General';
    const learningStyle = currentPrefs.learningStyle || 'mixed';
    const pace = currentPrefs.pace || 'normal';
    const complexity = currentPrefs.complexity || 'intermediate';
    const explanationStyle = currentPrefs.explanationStyle || 'balanced'; // concise/detailed/balanced
    const formatPreference = currentPrefs.formatPreference || 'text'; // text/video/flashcards - OUTPUT FORMAT
    const wantsExamples = currentPrefs.wants_examples !== false;
    const wantsAnalogies = currentPrefs.wants_analogies !== false;
    const wantsExercises = currentPrefs.wants_exercises !== false;

    // Build preference instructions
    const preferenceInstructions = [];
    
    if (wantsExamples) {
      preferenceInstructions.push('INCLUDE multiple concrete examples and demonstrations');
    }
    if (wantsAnalogies) {
      preferenceInstructions.push('USE analogies and metaphors to explain concepts');
    }
    if (wantsExercises) {
      preferenceInstructions.push('PROVIDE practice exercises or challenges when appropriate');
    }
    
    // Use explanationStyle for detail level (NOT formatPreference)
    if (explanationStyle === 'concise' || pace === 'fast') {
      preferenceInstructions.push('Keep explanations CONCISE and focused on key points');
    } else if (explanationStyle === 'detailed' || pace === 'slow') {
      preferenceInstructions.push('Provide DETAILED, thorough explanations with depth');
    }
    
    if (complexity === 'beginner') {
      preferenceInstructions.push('Use BEGINNER-FRIENDLY language, avoid jargon');
    } else if (complexity === 'advanced') {
      preferenceInstructions.push('Use TECHNICAL terminology, assume prior knowledge');
    }
    
    if (learningStyle === 'visual') {
      preferenceInstructions.push('Emphasize VISUAL descriptions and diagrams');
    } else if (learningStyle === 'reading_writing') {
      preferenceInstructions.push('Focus on written explanations and structured notes');
    }

    const systemPrompt = `You are an AI tutor helping a student learn about "${lessonTitle}" (Topic: ${lessonTopic}).

STUDENT PREFERENCES (MUST APPLY):
${preferenceInstructions.map(p => `- ${p}`).join('\n')}

STUDENT PROFILE:
- Learning Style: ${learningStyle}
- Preferred Pace: ${pace}
- Complexity Level: ${complexity}
- Explanation Style: ${explanationStyle}
- Output Format: ${formatPreference}
${wantsExamples ? '- Wants Examples: Yes' : ''}
${wantsAnalogies ? '- Wants Analogies: Yes' : ''}
${wantsExercises ? '- Wants Exercises: Yes' : ''}

YOUR ROLE:
- Provide clear, personalized explanations matching the preferences above
- Adapt to the student's learning pace
- Use examples and analogies as preferred
- Encourage questions and exploration

TEACHING APPROACH:
- ${pace === 'fast' ? 'Be concise and efficient' : pace === 'slow' ? 'Be patient and thorough, explain step-by-step' : 'Balance detail with clarity'}
- ${complexity === 'beginner' ? 'Use simple language and basic concepts' : complexity === 'advanced' ? 'Include technical details and advanced concepts' : 'Provide intermediate-level explanations'}
- Always check for understanding
- Build on previous knowledge

Remember: STRICTLY FOLLOW the student preferences listed above.`;

    console.log(`✅ [Model 2] Generated preference-aware system prompt for user ${userId}`);
    console.log(`   Format: ${formatPreference}, Style: ${explanationStyle}, Pace: ${pace}`);

    return this.createResponse({
      systemPrompt: {
        content: systemPrompt,
        version: 2,
        appliedPreferences: currentPrefs
      }
    });
  }

  /**
   * Update system prompt based on feedback
   * @private
   */
  async updateSystemPrompt(data) {
    const { userId, feedback, previousPrompt } = data;

    console.log(`🔄 [Model 2] Updating system prompt based on feedback`);

    // Get current preferences
    const currentPrefs = await this.getUserPreferences(userId);

    // Regenerate with updated preferences
    return await this.generateSystemPrompt({ userId, userPreferences: currentPrefs });
  }

  /**
   * Get current system prompt
   * @private
   */
  async getSystemPrompt(data) {
    const { userId } = data;
    
    const currentPrefs = await this.getUserPreferences(userId);
    
    return this.createResponse({
      preferences: currentPrefs
    });
  }

  /**
   * Adapt to detected learning patterns
   * @private
   */
  async adaptToLearningPattern(data) {
    console.log(`📈 [Model 2] Adapting to learning pattern`);
    return this.createResponse({ acknowledged: true });
  }

  /**
   * Incorporate feedback
   * @private
   */
  async incorporateFeedback(data) {
    console.log(`💡 [Model 2] Incorporating feedback`);
    return this.createResponse({ acknowledged: true });
  }
}

export default SystemPromptGenerator;
