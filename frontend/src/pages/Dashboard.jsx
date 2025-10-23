import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { evaluationAPI } from '../services/api';
import Modal from '../components/Modal';
import './Dashboard.css';

const Dashboard = () => {
  const { user, topics, addTopic, logout, fetchTopics } = useApp();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [testTopicName, setTestTopicName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [creatingTopicName, setCreatingTopicName] = useState('');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // Refresh topics when returning to dashboard
  useEffect(() => {
    if (user) {
      fetchTopics();
    }
  }, [user]);

  const handleCreateTopic = async () => {
    if (topicName.trim()) {
      setCreatingTopicName(topicName);
      setIsCreating(true);
      setShowModal(false);
      
      await addTopic(topicName);
      
      setIsCreating(false);
      setCreatingTopicName('');
      setTopicName('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleRunSystemTest = async () => {
    if (testTopicName.trim()) {
      setIsRunningTest(true);
      setShowTestModal(false);
      setTestResults(null);

      try {
        const response = await evaluationAPI.runSystemTest(testTopicName);
        setTestResults(response.data.results);
        await fetchTopics(); // Refresh topics to show the new test topic
      } catch (error) {
        console.error('Failed to run system test:', error);
        alert('Failed to run Model 6 system test. Please try again.');
      } finally {
        setIsRunningTest(false);
        setTestTopicName('');
      }
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Welcome, {user?.username}!</h1>
        <button onClick={handleLogout} className="btn-secondary">Logout</button>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-actions">
          <button onClick={() => setShowModal(true)} className="btn-create">
            Create new topic
          </button>
          <button onClick={() => setShowTestModal(true)} className="btn-test-model6">
            🤖 Run Model 6 System Test
          </button>
        </div>

        {isCreating && (
          <div className="creating-topic-overlay">
            <div className="creating-topic-card">
              <div className="spinner"></div>
              <h3>{creatingTopicName}</h3>
              <p>Creating learning path...</p>
            </div>
          </div>
        )}

        {topics.length === 0 && !isCreating ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p>No topics yet. Create your first topic to get started!</p>
          </div>
        ) : (
          <div className="topics-grid">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="topic-card"
                onClick={() => navigate(`/topic/${topic.id}`)}
              >
                <h3>{topic.name}</h3>
                <div className="topic-stats">
                  <span>{topic.lesson_count || 0} lessons</span>
                  <span>{topic.quiz_count || 0} quizzes</span>
                </div>
                <div className="topic-progress">
                  {topic.completed_lessons || 0} / {topic.lesson_count || 0} completed
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2>Create New Topic</h2>
          <div className="form-group">
            <label htmlFor="topicName">Topic Name</label>
            <input
              type="text"
              id="topicName"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="Enter topic name"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreateTopic} className="btn-primary">
              Create
            </button>
          </div>
        </Modal>
      )}

      {showTestModal && (
        <Modal onClose={() => setShowTestModal(false)}>
          <h2>🤖 Run Model 6 System Test</h2>
          <p className="modal-description">
            This comprehensive test will create a new topic, evaluate lesson quality,
            simulate student interactions, and assess quiz relevance.
          </p>
          <div className="form-group">
            <label htmlFor="testTopicName">Topic Name</label>
            <input
              type="text"
              id="testTopicName"
              value={testTopicName}
              onChange={(e) => setTestTopicName(e.target.value)}
              placeholder="e.g., React Hooks, Machine Learning Basics"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button onClick={() => setShowTestModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button 
              onClick={handleRunSystemTest} 
              className="btn-test-model6"
              disabled={!testTopicName.trim()}
            >
              Run Test
            </button>
          </div>
        </Modal>
      )}

      {isRunningTest && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner"></div>
            <h2>Running Comprehensive System Test...</h2>
            <p>This may take a few minutes</p>
            <div className="test-phases">
              <p>✓ Creating topic and learning path</p>
              <p>✓ Evaluating lesson explanations</p>
              <p>✓ Simulating student interactions</p>
              <p>✓ Testing quiz relevance</p>
            </div>
          </div>
        </div>
      )}

      {testResults && !isRunningTest && (
        <div className="test-results-overlay" onClick={() => setTestResults(null)}>
          <div className="test-results-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-results" onClick={() => setTestResults(null)}>×</button>
            <h2>Model 6 System Test Results</h2>
            
            <div className="overall-score">
              <h3>Overall Score</h3>
              <div className="score-circle">
                <span className="score-value">{testResults.overallScore?.toFixed(1)}</span>
                <span className="score-label">/ 100</span>
              </div>
            </div>

            <div className="phase-results">
              <div className="phase-card">
                <h3>📚 Phase 1: Topic Creation</h3>
                <div className="phase-details">
                  <p><strong>Topic:</strong> {testResults.phase1.topicName}</p>
                  <p><strong>Lessons:</strong> {testResults.phase1.lessonCount}</p>
                  <p><strong>Quizzes:</strong> {testResults.phase1.quizCount}</p>
                </div>
              </div>

              <div className="phase-card">
                <h3>📝 Phase 2: Lesson Evaluation</h3>
                <div className="phase-score">
                  Average Score: <strong>{testResults.phase2.averageScore.toFixed(1)}</strong>
                </div>
                <div className="lesson-scores">
                  {testResults.phase2.lessonScores.map((lesson, idx) => (
                    <div key={idx} className="lesson-score-item">
                      <div className="lesson-title">{lesson.title}</div>
                      <div className="score-bar-container">
                        <div 
                          className="score-bar" 
                          style={{width: `${lesson.score}%`}}
                        />
                        <span className="score-text">{lesson.score.toFixed(1)}</span>
                      </div>
                      <details className="score-breakdown">
                        <summary>Criteria Breakdown</summary>
                        <ul>
                          <li>Clarity: {lesson.breakdown.clarity}/25</li>
                          <li>Completeness: {lesson.breakdown.completeness}/25</li>
                          <li>Engagement: {lesson.breakdown.engagement}/20</li>
                          <li>Examples: {lesson.breakdown.examples}/15</li>
                          <li>Learning Outcome: {lesson.breakdown.learning_outcome}/15</li>
                        </ul>
                      </details>
                    </div>
                  ))}
                </div>
              </div>

              <div className="phase-card">
                <h3>💬 Phase 3: Student Interactions with Persona</h3>
                
                {testResults.phase3.persona && (
                  <div className="persona-card">
                    <h4>👤 Test Persona: {testResults.phase3.persona.name}</h4>
                    <div className="persona-details">
                      <p><strong>Background:</strong> {testResults.phase3.persona.background}</p>
                      <p><strong>Occupation:</strong> {testResults.phase3.persona.occupation}</p>
                      <p><strong>Learning Style:</strong> {testResults.phase3.persona.learningStyle}</p>
                      <p><strong>Communication:</strong> {testResults.phase3.persona.communicationStyle}</p>
                      <p><strong>Personality:</strong> {testResults.phase3.persona.personality.join(', ')}</p>
                      <p><strong>Challenges:</strong> {testResults.phase3.persona.challenges.join(', ')}</p>
                      <p><strong>Knowledge Level:</strong> {testResults.phase3.persona.priorKnowledge}</p>
                    </div>
                  </div>
                )}

                <div className="dual-scores">
                  <div className="score-metric">
                    <span className="metric-name">Response Quality</span>
                    <span className="metric-value">{testResults.phase3.averageQualityScore?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="score-metric adaptability">
                    <span className="metric-name">🎯 Adaptability</span>
                    <span className="metric-value">{testResults.phase3.averageAdaptabilityScore?.toFixed(1) || 'N/A'}</span>
                  </div>
                </div>

                <p className="interaction-count">
                  {testResults.phase3.interactionCount} interactions tested across {testResults.phase3.lessonsEvaluated} lessons
                </p>
                <div className="interaction-details">
                  {testResults.phase3.interactions.map((interaction, idx) => (
                    <details key={idx} className="interaction-item">
                      <summary>
                        {interaction.lessonTitle} - Quality: {interaction.averageQualityScore?.toFixed(1) || 'N/A'}, 
                        Adaptability: {interaction.averageAdaptabilityScore?.toFixed(1) || 'N/A'}
                      </summary>
                      <div className="qa-pairs">
                        {interaction.questions.map((qa, qIdx) => (
                          <div key={qIdx} className="qa-pair">
                            <p className="question"><strong>Q:</strong> {qa.question}</p>
                            <p className="answer"><strong>A:</strong> {qa.answer?.substring(0, 150) || 'N/A'}...</p>
                            <div className="qa-scores">
                              <span className="qa-quality">Quality: {qa.qualityScore}/100</span>
                              <span className="qa-adaptability">Adaptability: {qa.adaptabilityScore}/100</span>
                            </div>
                            {qa.adaptabilityBreakdown && (
                              <details className="adaptability-breakdown">
                                <summary>Adaptability Breakdown</summary>
                                <ul>
                                  <li>Learning Style Match: {qa.adaptabilityBreakdown.learningStyleMatch}/20</li>
                                  <li>Communication Match: {qa.adaptabilityBreakdown.communicationMatch}/20</li>
                                  <li>Knowledge Level: {qa.adaptabilityBreakdown.knowledgeLevel}/20</li>
                                  <li>Challenge Accommodation: {qa.adaptabilityBreakdown.challengeAccommodation}/20</li>
                                  <li>Expectation Fulfillment: {qa.adaptabilityBreakdown.expectationFulfillment}/20</li>
                                </ul>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>

              <div className="phase-card">
                <h3>📋 Phase 4: Quiz Evaluation</h3>
                <div className="quiz-scores">
                  <div className="quiz-metric">
                    <span className="metric-label">Relevance</span>
                    <div className="metric-score">{testResults.phase4.relevanceScore.toFixed(1)}/100</div>
                  </div>
                  <div className="quiz-metric">
                    <span className="metric-label">Answerability</span>
                    <div className="metric-score">{testResults.phase4.answerabilityScore.toFixed(1)}/100</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="results-actions">
              <button onClick={() => setTestResults(null)} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
