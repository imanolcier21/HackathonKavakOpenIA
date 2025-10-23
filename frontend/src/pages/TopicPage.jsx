import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import './TopicPage.css';

const TopicPage = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { topics, fetchTopicDetails, loading } = useApp();
  const [topic, setTopic] = useState(null);

  useEffect(() => {
    const loadTopic = async () => {
      let topicData = topics.find(t => t.id === parseInt(topicId));
      
      // If topic doesn't have lessons/quizzes loaded, fetch details
      if (topicData && (!topicData.lessons || topicData.lessons.length === 0)) {
        const detailed = await fetchTopicDetails(parseInt(topicId));
        if (detailed) {
          topicData = detailed;
        }
      }
      
      setTopic(topicData);
    };

    loadTopic();
  }, [topicId, topics, fetchTopicDetails]);

  if (loading && !topic) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!topic) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Topic not found</div>;
  }

  // Ensure lessons and quizzes arrays exist
  const lessons = topic.lessons || [];
  const quizzes = topic.quizzes || [];

  // Create timeline items (lessons and quizzes interleaved)
  const timelineItems = [];
  const lessonsPerQuiz = Math.ceil(lessons.length / (quizzes.length + 1));
  
  let lessonIndex = 0;
  let quizIndex = 0;

  while (lessonIndex < lessons.length || quizIndex < quizzes.length) {
    // Add a group of lessons
    for (let i = 0; i < lessonsPerQuiz && lessonIndex < lessons.length; i++) {
      timelineItems.push({
        type: 'lesson',
        data: lessons[lessonIndex],
        index: lessonIndex
      });
      lessonIndex++;
    }

    // Add a quiz after the lesson group
    if (quizIndex < quizzes.length) {
      timelineItems.push({
        type: 'quiz',
        data: quizzes[quizIndex],
        index: quizIndex
      });
      quizIndex++;
    }
  }

  // Check if an item should be locked (not yet accessible)
  const isItemLocked = (item, itemIndex) => {
    if (itemIndex === 0) return false;
    
    // Check all previous items
    for (let i = 0; i < itemIndex; i++) {
      const prevItem = timelineItems[i];
      if (prevItem.type === 'lesson' && !prevItem.data.completed) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="topic-page">
      <header className="topic-header">
        <button onClick={() => navigate('/dashboard')} className="btn-back">
          ← Back to Dashboard
        </button>
        <h1>{topic.name}</h1>
      </header>

      <div className="topic-content">
        <div className="timeline-header">
          <h2>Learning Path</h2>
          <p className="timeline-description">Follow the path below to complete this topic</p>
        </div>

        {timelineItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p>No lessons or quizzes yet. Create some content to get started!</p>
          </div>
        ) : (
          <div className="timeline">
            {timelineItems.map((item, index) => {
            const locked = isItemLocked(item, index);
            
            if (item.type === 'lesson') {
              return (
                <div key={`lesson-${item.index}`} className="timeline-item">
                  <div className="timeline-marker">
                    <div className={`timeline-dot ${item.data.completed ? 'completed' : ''} ${locked ? 'locked' : ''}`}>
                      {item.data.completed ? '✓' : locked ? '🔒' : index + 1}
                    </div>
                    {index < timelineItems.length - 1 && <div className="timeline-line"></div>}
                  </div>
                  <div 
                    className={`timeline-content lesson-content ${item.data.completed ? 'completed' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && navigate(`/topic/${topicId}/lesson/${item.data.id}`)}
                  >
                    <div className="timeline-badge lesson-badge">📚 Lesson</div>
                    <h3>{item.data.title}</h3>
                    {item.data.completed && <span className="status-text">Completed</span>}
                    {locked && <span className="status-text locked-text">Complete previous items first</span>}
                  </div>
                </div>
              );
            } else {
              return (
                <div key={`quiz-${item.index}`} className="timeline-item">
                  <div className="timeline-marker">
                    <div className={`timeline-dot quiz-dot ${locked ? 'locked' : ''}`}>
                      {locked ? '🔒' : '?'}
                    </div>
                    {index < timelineItems.length - 1 && <div className="timeline-line"></div>}
                  </div>
                  <div 
                    className={`timeline-content quiz-content ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && navigate(`/topic/${topicId}/quiz/${item.data.id}`)}
                  >
                    <div className="timeline-badge quiz-badge">🎯 Quiz</div>
                    <h3>{item.data.title}</h3>
                    <p className="quiz-info">{item.data.question_count || 0} questions</p>
                    {locked && <span className="status-text locked-text">Complete previous lessons first</span>}
                  </div>
                </div>
              );
            }
          })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicPage;
