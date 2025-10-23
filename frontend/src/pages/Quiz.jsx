import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quizAPI } from '../services/api';
import './Quiz.css';

const Quiz = () => {
  const { topicId, quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submittedAnswers, setSubmittedAnswers] = useState([]);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await quizAPI.getById(parseInt(quizId));
        const quizData = response.data.quiz;
        
        console.log('Fetched quiz data:', quizData); // Debug log
        
        // Transform questions to match frontend format
        const transformedQuiz = {
          id: quizData.id,
          title: quizData.title,
          description: quizData.description,
          questions: (quizData.questions || []).map(q => {
            let options = q.options;
            
            // Parse options if it's a string
            if (typeof options === 'string') {
              try {
                options = JSON.parse(options);
              } catch (e) {
                console.error('Failed to parse options:', options, e);
                options = [];
              }
            }
            
            // Ensure options is an array
            if (!Array.isArray(options)) {
              console.error('Options is not an array:', options);
              options = [];
            }
            
            return {
              id: q.id,
              question: q.question,
              options: options,
              correctAnswer: q.correct_answer
            };
          })
        };
        
        console.log('Transformed quiz:', transformedQuiz); // Debug log
        setQuiz(transformedQuiz);
      } catch (error) {
        console.error('Failed to fetch quiz:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading quiz...</div>;
  }

  if (!quiz) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Quiz not found</div>;
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>No questions available</h2>
        <p>This quiz doesn't have any questions yet.</p>
        <button onClick={() => navigate(`/topic/${topicId}`)} className="btn-back">
          ← Back to Topic
        </button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  
  if (!currentQuestion) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Question not found</h2>
        <button onClick={() => navigate(`/topic/${topicId}`)} className="btn-back">
          ← Back to Topic
        </button>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  const handleAnswerSelect = (optionIndex) => {
    setSelectedAnswer(optionIndex);
  };

  const handleNext = async () => {
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    const newAnswers = [...answers, { questionId: currentQuestion.id, selectedAnswer, isCorrect }];
    setAnswers(newAnswers);

    if (isCorrect) {
      setScore(score + 1);
    }

    if (isLastQuestion) {
      // Submit quiz to backend
      try {
        const submissionData = newAnswers.map(ans => ({
          questionId: ans.questionId,
          selectedAnswer: ans.selectedAnswer
        }));
        
        const response = await quizAPI.submit(parseInt(quizId), submissionData);
        setSubmittedAnswers(response.data.attempt.answers || newAnswers);
      } catch (error) {
        console.error('Failed to submit quiz:', error);
        setSubmittedAnswers(newAnswers);
      }
      
      setShowResult(true);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
    }
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnswers([]);
  };

  if (showResult) {
    const percentage = (score / quiz.questions.length) * 100;
    return (
      <div className="quiz-page">
        <header className="quiz-header">
          <button onClick={() => navigate(`/topic/${topicId}`)} className="btn-back">
            ← Back to Topic
          </button>
          <h1>{quiz.title}</h1>
        </header>

        <div className="quiz-container">
          <div className="quiz-result">
            <h2>Quiz Complete!</h2>
            <div className="score-circle">
              <span className="score-text">{percentage.toFixed(0)}%</span>
            </div>
            <p className="score-detail">
              You got {score} out of {quiz.questions.length} questions correct
            </p>
            
            <div className="result-actions">
              <button onClick={handleRetry} className="btn-retry">Try Again</button>
              <button onClick={() => navigate(`/topic/${topicId}`)} className="btn-finish">
                Back to Topic
              </button>
            </div>

            <div className="answers-review">
              <h3>Review Your Answers</h3>
              {quiz.questions.map((question, index) => {
                const userAnswer = (submittedAnswers.length > 0 ? submittedAnswers : answers)[index];
                const isCorrect = userAnswer?.isCorrect ?? (userAnswer?.selectedAnswer === question.correctAnswer);
                return (
                  <div key={question.id} className={`review-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                    <p className="review-question">{index + 1}. {question.question}</p>
                    <p className="review-answer">
                      Your answer: {question.options[userAnswer?.selectedAnswer]}
                      {!isCorrect && (
                        <span className="correct-answer">
                          {' '}(Correct: {question.options[question.correctAnswer]})
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <header className="quiz-header">
        <button onClick={() => navigate(`/topic/${topicId}`)} className="btn-back">
          ← Back to Topic
        </button>
        <h1>{quiz.title}</h1>
      </header>

      <div className="quiz-container">
        <div className="quiz-progress">
          Question {currentQuestionIndex + 1} of {quiz.questions.length}
        </div>

        <div className="question-card">
          <h2 className="question-text">{currentQuestion.question}</h2>
          
          <div className="options-list">
            {currentQuestion.options && Array.isArray(currentQuestion.options) ? (
              currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
                  onClick={() => handleAnswerSelect(index)}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{option}</span>
                </button>
              ))
            ) : (
              <p>No options available for this question</p>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={selectedAnswer === null}
            className="btn-next"
          >
            {isLastQuestion ? 'Finish Quiz' : 'Next Question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Quiz;
