import React, { useState } from 'react';
import './VideoPlayer.css';

const VideoPlayer = ({ videoData }) => {
  const [showTranscript, setShowTranscript] = useState(false);

  if (!videoData) {
    return <div className="video-error">No video data available</div>;
  }

  // Handle fallback case when Sora 2 fails
  if (videoData.fallback || !videoData.videoUrl) {
    return (
      <div className="video-fallback">
        <div className="fallback-icon">🎬</div>
        <h3>{videoData.title}</h3>
        <p className="fallback-message">
          Video generation is currently unavailable. Here's the content:
        </p>
        <div className="fallback-content">
          <p><strong>Topic:</strong> {videoData.soraPrompt}</p>
          <div className="narration-box">
            <strong>Explanation:</strong>
            <p>{videoData.narration}</p>
          </div>
          {videoData.keyTakeaways && videoData.keyTakeaways.length > 0 && (
            <div className="takeaways">
              <strong>Key Takeaways:</strong>
              <ul>
                {videoData.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx}>{takeaway}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Construct full video URL - if relative path, prepend backend URL
  const fullVideoUrl = videoData.videoUrl.startsWith('http') 
    ? videoData.videoUrl 
    : `http://localhost:5000${videoData.videoUrl}`;

  console.log('🎥 VideoPlayer - videoData.videoUrl:', videoData.videoUrl);
  console.log('🎥 VideoPlayer - fullVideoUrl:', fullVideoUrl);

  return (
    <div className="video-player-container">
      <div className="video-wrapper">
        <video
          controls
          className="educational-video"
          poster={videoData.thumbnailUrl}
        >
          <source src={fullVideoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="video-info">
        <h3 className="video-title">{videoData.title}</h3>
        <span className="video-duration">⏱️ {videoData.duration}</span>
      </div>

      <div className="video-controls-section">
        <button
          className="transcript-toggle"
          onClick={() => setShowTranscript(!showTranscript)}
        >
          {showTranscript ? '▼' : '▶'} {showTranscript ? 'Hide' : 'Show'} Narration
        </button>
      </div>

      {showTranscript && (
        <div className="transcript-section">
          <p className="narration-text">{videoData.narration}</p>
        </div>
      )}

      {videoData.keyTakeaways && videoData.keyTakeaways.length > 0 && (
        <div className="key-takeaways">
          <h4>🎯 Key Takeaways:</h4>
          <ul>
            {videoData.keyTakeaways.map((takeaway, idx) => (
              <li key={idx}>{takeaway}</li>
            ))}
          </ul>
        </div>
      )}

      {videoData.soraPrompt && (
        <details className="video-prompt-details">
          <summary>📝 Video Generation Prompt</summary>
          <p className="sora-prompt">{videoData.soraPrompt}</p>
        </details>
      )}
    </div>
  );
};

export default VideoPlayer;
