import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, topicsAPI, lessonsAPI, chatAPI } from '../services/api';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [topics, setTopics] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check for existing user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      fetchTopics();
    }
  }, []);

  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.login(username, password);
      const { token, user: userData } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      await fetchTopics();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.register(username, email, password);
      const { token, user: userData } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      await fetchTopics();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setTopics([]);
    setChatMessages([]);
  };

  const fetchTopics = async () => {
    try {
      setLoading(true);
      const response = await topicsAPI.getAll();
      const topicsData = response.data.topics;
      
      // Transform backend data to match frontend format
      const transformedTopics = topicsData.map(topic => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        lesson_count: parseInt(topic.lesson_count) || 0,
        quiz_count: parseInt(topic.quiz_count) || 0,
        completed_lessons: parseInt(topic.completed_lessons) || 0,
        lessons: [],
        quizzes: []
      }));
      
      setTopics(transformedTopics);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
      setError(err.response?.data?.error || 'Failed to fetch topics');
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicDetails = async (topicId) => {
    try {
      setLoading(true);
      const response = await topicsAPI.getById(topicId);
      const topicData = response.data.topic;
      
      // Transform backend data
      const transformedTopic = {
        id: topicData.id,
        name: topicData.name,
        description: topicData.description,
        lessons: topicData.lessons.map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
          completed: lesson.completed || false,
          order_index: lesson.order_index
        })),
        quizzes: topicData.quizzes.map(quiz => ({
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          question_count: parseInt(quiz.question_count) || 0,
          order_index: quiz.order_index
        }))
      };
      
      // Update topics array with detailed data
      setTopics(prevTopics => 
        prevTopics.map(t => t.id === topicId ? transformedTopic : t)
      );
      
      return transformedTopic;
    } catch (err) {
      console.error('Failed to fetch topic details:', err);
      setError(err.response?.data?.error || 'Failed to fetch topic details');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addTopic = async (topicName, description = '') => {
    try {
      setLoading(true);
      setError(null);
      const response = await topicsAPI.create(topicName, description);
      await fetchTopics();
      return response.data.topic;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create topic');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const completeLesson = async (topicId, lessonId) => {
    try {
      await lessonsAPI.complete(lessonId);
      
      // Update local state
      setTopics(prevTopics => 
        prevTopics.map(topic => {
          if (topic.id === topicId) {
            return {
              ...topic,
              lessons: topic.lessons.map(lesson => 
                lesson.id === lessonId ? { ...lesson, completed: true } : lesson
              )
            };
          }
          return topic;
        })
      );
    } catch (err) {
      console.error('Failed to complete lesson:', err);
      setError(err.response?.data?.error || 'Failed to complete lesson');
    }
  };

  const loadChatMessages = async (lessonId) => {
    try {
      const response = await chatAPI.getMessages(lessonId);
      const messages = response.data.messages.map(msg => ({
        message: msg.message,
        isUser: msg.is_user,
        timestamp: new Date(msg.created_at)
      }));
      setChatMessages(messages);
      return messages;
    } catch (err) {
      console.error('Failed to load chat messages:', err);
      setChatMessages([]);
      return [];
    }
  };

  const getInitialExplanation = async (lessonId) => {
    try {
      const response = await chatAPI.getInitialExplanation(lessonId);
      return response.data.response;
    } catch (err) {
      // If 409 conflict (already exists), just reload messages
      if (err.response?.status === 409) {
        console.log('Initial explanation already exists, reloading messages...');
        await loadChatMessages(lessonId);
        return null; // Signal that we should skip adding message
      }
      // If 400 (already has messages), reload them
      if (err.response?.status === 400) {
        console.log('Lesson already has messages, reloading...');
        await loadChatMessages(lessonId);
        return null;
      }
      console.error('Failed to get initial explanation:', err);
      return "I'm having trouble generating the initial explanation. Please try again.";
    }
  };

  const addChatMessage = async (lessonId, message, isUser = true) => {
    try {
      // Add to local state immediately for better UX
      const newMessage = { message, isUser, timestamp: new Date() };
      setChatMessages(prev => [...prev, newMessage]);
      
      // Save to backend
      await chatAPI.createMessage(lessonId, message, isUser);
    } catch (err) {
      console.error('Failed to save chat message:', err);
    }
  };

  const resetChat = async (lessonId) => {
    try {
      if (lessonId) {
        await chatAPI.deleteMessages(lessonId);
      }
      setChatMessages([]);
    } catch (err) {
      console.error('Failed to reset chat:', err);
      setChatMessages([]);
    }
  };

  const getMockResponse = async (lessonId, userMessage) => {
    try {
      const response = await chatAPI.getAIResponse(lessonId, userMessage);
      return response.data.response;
    } catch (err) {
      console.error('Failed to get AI response:', err);
      return "I'm having trouble responding right now. Please try again.";
    }
  };

  const value = {
    user,
    topics,
    currentLesson,
    chatMessages,
    loading,
    error,
    login,
    register,
    logout,
    addTopic,
    fetchTopics,
    fetchTopicDetails,
    setCurrentLesson,
    completeLesson,
    loadChatMessages,
    getInitialExplanation,
    addChatMessage,
    resetChat,
    getMockResponse
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
