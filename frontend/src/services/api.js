import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (username, email, password) =>
    api.post('/auth/register', { username, email, password }),
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  getProfile: () =>
    api.get('/auth/profile'),
};

// Topics API
export const topicsAPI = {
  getAll: () =>
    api.get('/topics'),
  getById: (id) =>
    api.get(`/topics/${id}`),
  create: (name, description) =>
    api.post('/topics', { name, description }),
  update: (id, name, description) =>
    api.put(`/topics/${id}`, { name, description }),
  delete: (id) =>
    api.delete(`/topics/${id}`),
};

// Lessons API
export const lessonsAPI = {
  getByTopic: (topicId) =>
    api.get(`/lessons/topic/${topicId}/lessons`),
  getById: (lessonId) =>
    api.get(`/lessons/${lessonId}`),
  create: (topicId, title, content, order_index) =>
    api.post(`/lessons/topic/${topicId}/lessons`, { title, content, order_index }),
  update: (lessonId, title, content, order_index) =>
    api.put(`/lessons/${lessonId}`, { title, content, order_index }),
  complete: (lessonId) =>
    api.post(`/lessons/${lessonId}/complete`),
  uncomplete: (lessonId) =>
    api.post(`/lessons/${lessonId}/uncomplete`),
  delete: (lessonId) =>
    api.delete(`/lessons/${lessonId}`),
};

// Quiz API
export const quizAPI = {
  getById: (quizId) =>
    api.get(`/quiz/${quizId}`),
  create: (topicId, title, description, order_index) =>
    api.post(`/quiz/topic/${topicId}/quiz`, { title, description, order_index }),
  addQuestion: (quizId, question, options, correct_answer, order_index) =>
    api.post(`/quiz/${quizId}/question`, { question, options, correct_answer, order_index }),
  submit: (quizId, answers) =>
    api.post(`/quiz/${quizId}/submit`, { answers }),
  getAttempts: (quizId) =>
    api.get(`/quiz/${quizId}/attempts`),
  delete: (quizId) =>
    api.delete(`/quiz/${quizId}`),
};

// Chat API
export const chatAPI = {
  getMessages: (lessonId, limit = 50, offset = 0) =>
    api.get(`/chat/lesson/${lessonId}/messages`, { params: { limit, offset } }),
  createMessage: (lessonId, message, is_user = true) =>
    api.post(`/chat/lesson/${lessonId}/messages`, { message, is_user }),
  deleteMessages: (lessonId) =>
    api.delete(`/chat/lesson/${lessonId}/messages`),
  getInitialExplanation: (lessonId) =>
    api.post(`/chat/lesson/${lessonId}/initial-explanation`),
  getAIResponse: (lessonId, message) =>
    api.post(`/chat/lesson/${lessonId}/ai-response`, { message }),
};

// Evaluation API (Model 6)
export const evaluationAPI = {
  runSystemTest: (topicName) =>
    api.post(`/evaluation/system-test`, { topicName }),
  evaluateLesson: (lessonId) =>
    api.post(`/evaluation/lesson/${lessonId}/evaluate`),
  evaluateTopic: (topicId) =>
    api.post(`/evaluation/topic/${topicId}/evaluate`),
};

export default api;
