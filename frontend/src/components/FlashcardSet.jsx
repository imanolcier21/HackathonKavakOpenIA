import React, { useState } from 'react';
import './FlashcardSet.css';

const FlashcardSet = ({ flashcardData }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!flashcardData || !flashcardData.flashcards || flashcardData.flashcards.length === 0) {
    return <div className="flashcard-error">No flashcards available</div>;
  }

  const cards = flashcardData.flashcards;
  const card = cards[currentCard];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentCard((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return '#00b894';
      case 'medium': return '#fdcb6e';
      case 'hard': return '#d63031';
      default: return '#667eea';
    }
  };

  if (showAll) {
    return (
      <div className="flashcard-set-container">
        <div className="flashcard-header">
          <h3>📚 {flashcardData.topic}</h3>
          {flashcardData.subtopic && <p className="subtopic">{flashcardData.subtopic}</p>}
          <button 
            className="view-toggle-btn"
            onClick={() => setShowAll(false)}
          >
            📖 Card View
          </button>
        </div>

        <div className="all-cards-view">
          {cards.map((c, idx) => (
            <div key={c.id || idx} className="card-item">
              <div className="card-item-header">
                <span className="card-number">Card {idx + 1}</span>
                <span 
                  className="difficulty-badge" 
                  style={{ background: getDifficultyColor(c.difficulty) }}
                >
                  {c.difficulty}
                </span>
              </div>
              <div className="card-item-content">
                <div className="card-item-front">
                  <strong>Q:</strong> {c.front}
                </div>
                <div className="card-item-back">
                  <strong>A:</strong> {c.back}
                </div>
                {c.hint && (
                  <div className="card-item-hint">
                    💡 <em>{c.hint}</em>
                  </div>
                )}
                {c.mnemonic && (
                  <div className="card-item-mnemonic">
                    🧠 <strong>Mnemonic:</strong> {c.mnemonic}
                  </div>
                )}
                {c.tags && c.tags.length > 0 && (
                  <div className="card-item-tags">
                    {c.tags.map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {flashcardData.studyTips && flashcardData.studyTips.length > 0 && (
          <div className="study-tips">
            <h4>📝 Study Tips:</h4>
            <ul>
              {flashcardData.studyTips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {flashcardData.reviewSchedule && (
          <div className="review-schedule">
            <strong>🔄 Review Schedule:</strong> {flashcardData.reviewSchedule}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flashcard-set-container">
      <div className="flashcard-header">
        <h3>📚 {flashcardData.topic}</h3>
        {flashcardData.subtopic && <p className="subtopic">{flashcardData.subtopic}</p>}
        <button 
          className="view-toggle-btn"
          onClick={() => setShowAll(true)}
        >
          📋 View All Cards
        </button>
      </div>

      <div className="flashcard-counter">
        Card {currentCard + 1} of {cards.length}
      </div>

      <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
        <div className="flashcard-inner">
          <div className="flashcard-front">
            <div className="card-label">QUESTION</div>
            <div className="card-content">
              {card.front}
            </div>
            <div className="flip-hint">👆 Click to flip</div>
          </div>
          <div className="flashcard-back">
            <div className="card-label">ANSWER</div>
            <div className="card-content">
              {card.back}
            </div>
            {card.example && (
              <div className="card-example">
                <strong>Example:</strong> {card.example}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flashcard-metadata">
        <span 
          className="difficulty-badge" 
          style={{ background: getDifficultyColor(card.difficulty) }}
        >
          {card.difficulty}
        </span>
        {card.tags && card.tags.length > 0 && (
          <div className="tags-container">
            {card.tags.map((tag, i) => (
              <span key={i} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {card.hint && !isFlipped && (
        <div className="hint-box">
          <strong>💡 Hint:</strong> {card.hint}
        </div>
      )}

      {card.mnemonic && isFlipped && (
        <div className="mnemonic-box">
          <strong>🧠 Mnemonic:</strong> {card.mnemonic}
        </div>
      )}

      <div className="flashcard-navigation">
        <button 
          onClick={handlePrev} 
          className="nav-btn"
          disabled={cards.length === 1}
        >
          ← Previous
        </button>
        <button 
          onClick={handleNext} 
          className="nav-btn"
          disabled={cards.length === 1}
        >
          Next →
        </button>
      </div>

      {flashcardData.reviewSchedule && (
        <div className="review-schedule">
          <strong>🔄 Recommended Review:</strong> {flashcardData.reviewSchedule}
        </div>
      )}
    </div>
  );
};

export default FlashcardSet;
