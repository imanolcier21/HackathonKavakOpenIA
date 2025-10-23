# Learning Platform - Hackathon Project

A simple educational platform built with React for a hackathon. This application includes user authentication, topic management, interactive lessons, and quizzes.

## Features

### 1. Login System
- Simple username/password authentication
- No encryption (hackathon project)
- Redirects to dashboard after login

### 2. Dashboard
- View all available topics
- See progress for each topic (lessons completed)
- Create new topics with modal dialog
- Logout functionality

### 3. Topic Page
- View all lessons within a topic
- See completion status for each lesson
- Access quiz buttons for the topic

### 4. Lesson Chat Interface
- Interactive chat with AI tutor character
- Character avatar displayed at the top
- Send messages and receive mock AI responses
- Chat bubbles for user and AI messages
- "I have understood everything" button to complete the lesson
- Auto-scroll to latest messages

### 5. Quiz System
- Dynamic quiz generation from JSON data
- Multiple choice questions
- Progress indicator
- Interactive option selection
- Score calculation
- Detailed results page with:
  - Percentage score
  - Correct/incorrect answer review
  - Option to retry or return to topic

## Mock Data Structure

The application includes pre-populated mock data:
- 2 sample topics (Introduction to React, JavaScript Basics)
- Multiple lessons per topic
- Quiz questions with correct answers
- Mock AI responses for the chat

## Running the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Open http://localhost:5173/ in your browser

## Project Structure

```
src/
  ├── components/
  │   ├── Modal.jsx          # Reusable modal component
  │   └── Modal.css
  ├── context/
  │   └── AppContext.jsx     # Global state management & mock data
  ├── pages/
  │   ├── Login.jsx          # Login page
  │   ├── Dashboard.jsx      # Main dashboard
  │   ├── TopicPage.jsx      # Topic overview with lessons
  │   ├── LessonChat.jsx     # Interactive lesson chat
  │   ├── Quiz.jsx           # Quiz interface
  │   └── *.css              # Component styles
  ├── App.jsx                # Main app with routing
  ├── main.jsx               # App entry point
  └── index.css              # Global styles
```

## Technologies Used

- React 19
- React Router DOM (for navigation)
- Vite (build tool)
- CSS (styling)

## Notes

- This is a hackathon project with no backend integration
- All data is stored in memory (resets on page refresh)
- No authentication encryption or security measures
- Mock AI responses are randomly selected from a predefined list
