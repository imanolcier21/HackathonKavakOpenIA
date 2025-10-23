import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { evaluationAPI, chatAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import VideoPlayer from '../components/VideoPlayer';
import FlashcardSet from '../components/FlashcardSet';
import './LessonChat.css';

const LessonChat = () => {
  const { topicId, lessonId } = useParams();
  const navigate = useNavigate();
  const { topics, chatMessages, addChatMessage, loadChatMessages, getInitialExplanation, getMockResponse, completeLesson } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const messagesEndRef = useRef(null);
  const initializedRef = useRef(false);

  const topic = topics.find(t => t.id === parseInt(topicId));
  const lesson = topic?.lessons?.find(l => l.id === parseInt(lessonId));

  useEffect(() => {
    const initChat = async () => {
      // Prevent multiple initialization calls
      if (initializedRef.current || isInitializing || !lesson) {
        return;
      }
      
      setIsInitializing(true);
      initializedRef.current = true;
      
      try {
        // Load existing messages first
        const messages = await loadChatMessages(parseInt(lessonId));
        
        // If no messages, generate initial explanation from backend
        if ((!messages || messages.length === 0) && !isTyping) {
          setIsTyping(true);
          try {
            const explanation = await getInitialExplanation(parseInt(lessonId));
            // Backend already saved the message, just reload to get it
            if (explanation) {
              await loadChatMessages(parseInt(lessonId));
            }
          } catch (error) {
            console.error('Failed to get initial explanation:', error);
            // Fallback to simple message if backend fails
            const fallback = `Hello! Welcome to **"${lesson.title}"**. I'm here to help you learn. Feel free to ask me anything!`;
            await addChatMessage(parseInt(lessonId), fallback, false);
          } finally {
            setIsTyping(false);
          }
        }
      } finally {
        setIsInitializing(false);
      }
    };
    
    initChat();
    
    return () => {
      // Only reset on unmount, not on every render
      if (initializedRef.current) {
        initializedRef.current = false;
      }
    };
  }, [lessonId]); // Removed lesson?.title from dependencies to prevent re-runs

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      const userMsg = inputMessage;
      setInputMessage('');
      
      // Add user message
      await addChatMessage(parseInt(lessonId), userMsg, true);
      
      setIsTyping(true);
      
      // Get AI response from backend with lessonId
      try {
        const apiResponse = await chatAPI.getAIResponse(parseInt(lessonId), userMsg);
        const { response, responseType } = apiResponse.data;
        
        // Serialize multimodal responses before saving
        let messageToSave;
        if (responseType === 'video' || responseType === 'flashcards') {
          messageToSave = JSON.stringify({ type: responseType, data: response });
        } else {
          messageToSave = response;
        }
        
        await addChatMessage(parseInt(lessonId), messageToSave, false);
      } catch (error) {
        console.error('Failed to get AI response:', error);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleFinishLesson = () => {
    completeLesson(parseInt(topicId), parseInt(lessonId));
    navigate(`/topic/${topicId}`);
  };

  const handleTestModel6 = async () => {
    try {
      setIsEvaluating(true);
      setEvaluation(null);
      
      const response = await evaluationAPI.evaluateLesson(parseInt(lessonId));
      setEvaluation(response.data.evaluation);
      
      alert(`Model 6 Evaluation Complete!\n\nScore: ${response.data.evaluation.overallScore}/100\n\nFeedback: ${response.data.evaluation.studentFeedback}`);
    } catch (error) {
      console.error('Failed to evaluate lesson:', error);
      alert('Failed to run Model 6 evaluation. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!lesson) {
    return <div>Lesson not found</div>;
  }

  return (
    <div className="lesson-chat">
      <header className="lesson-header">
        <button onClick={() => navigate(`/topic/${topicId}`)} className="btn-back">
          ← Back to Topic
        </button>
        <h1>{lesson.title}</h1>
      </header>

      <div className="chat-container">
        <div className="character-avatar">
          <div className="avatar">🎓</div>
          <span className="character-name">AI Tutor</span>
        </div>

        <div className="messages-container">
          {chatMessages.map((msg, index) => {
            // Parse multimodal content if message is JSON
            let messageContent = msg.message;
            let messageType = 'text';
            
            if (!msg.isUser && typeof msg.message === 'string' && msg.message.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(msg.message);
                if (parsed.type && parsed.data) {
                  messageType = parsed.type;
                  messageContent = parsed.data;
                }
              } catch (e) {
                // If parsing fails, treat as regular text
                messageType = 'text';
              }
            }

            return (
              <div key={index} className={`message ${msg.isUser ? 'user-message' : 'ai-message'}`}>
                <div className="message-bubble">
                  {msg.isUser ? (
                    <ReactMarkdown>{String(msg.message)}</ReactMarkdown>
                  ) : (
                    <>
                      {messageType === 'video' && <VideoPlayer videoData={messageContent} />}
                      {messageType === 'flashcards' && <FlashcardSet flashcardData={messageContent} />}
                      {messageType === 'text' && <ReactMarkdown>{String(messageContent)}</ReactMarkdown>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div className="message ai-message">
              <div className="message-bubble typing-indicator">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="message-input-form">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="message-input"
          />
          <button type="submit" className="btn-send">Send</button>
        </form>

        <div className="lesson-actions">
          <button onClick={handleFinishLesson} className="btn-finish">
            I have understood everything
          </button>
          <button 
            onClick={handleTestModel6} 
            className="btn-evaluate"
            disabled={isEvaluating}
          >
            {isEvaluating ? '🤖 Evaluating...' : '🤖 Test Model 6'}
          </button>
        </div>

        {evaluation && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ marginTop: 0 }}>Model 6 Evaluation Results</h3>
            <div style={{ marginBottom: '10px' }}>
              <strong>Overall Score:</strong> {evaluation.overallScore}/100
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Breakdown:</strong>
              <ul style={{ marginTop: '5px' }}>
                <li>Clarity: {evaluation.breakdown.clarity}/25</li>
                <li>Completeness: {evaluation.breakdown.completeness}/25</li>
                <li>Engagement: {evaluation.breakdown.engagement}/20</li>
                <li>Examples: {evaluation.breakdown.examples}/15</li>
                <li>Learning Outcome: {evaluation.breakdown.learningOutcome}/15</li>
              </ul>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Strengths:</strong>
              <ul style={{ marginTop: '5px' }}>
                {evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Weaknesses:</strong>
              <ul style={{ marginTop: '5px' }}>
                {evaluation.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
            <div>
              <strong>Student Feedback:</strong> {evaluation.studentFeedback}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonChat;
