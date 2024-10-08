// App.js
import React, { useState, useEffect } from 'react';
import InputForm from './components/InputForm';
import Analysis from './components/Analysis';
import ErrorBoundary from './components/ErrorBoundary';
import { saveToCache, loadFromCache, clearExpiredCache } from './utils/cacheUtils';
import { trackAnalysis, getAnalytics } from './utils/analyticsUtils';
import './App.css';

const API_KEY = 'AIzaSyArqu0qB8jyJBjgjkPFCxOPD4IIcNDrzAg';
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent';

const CATEGORY_PROMPTS = {
  film: "Analyze the film or TV series '{title}' by {author}. Include a brief synopsis, discuss its themes, cinematography, and cultural impact. Evaluate its strengths and weaknesses, and explain its significance in the context of its genre and time period.",
  music: "Analyze the musical work '{title}' by {author}. Discuss its genre, musical style, lyrical themes (if applicable), and production. Evaluate its cultural impact, critical reception, and place in the artist's discography. Consider its influence on other artists or the genre as a whole.",
  literature: "Analyze the novel or short story collection '{title}' by {author}. Provide a brief plot summary, discuss major themes, character development, and writing style. Evaluate its literary merits, cultural significance, and impact on literature. Consider how it fits into the author's body of work and its genre.",
  visual_art: "Analyze the visual artwork '{title}' by {author}. Describe its medium, style, and composition. Discuss the artist's techniques, the artwork's themes or subject matter, and its historical or cultural context. Evaluate its significance in the artist's career and its impact on the art world."
};

function App() {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    clearExpiredCache();
    setAnalytics(getAnalytics());
  }, []);

  const handleAnalysis = async (title, author, category) => {
  setError(null);
  setIsLoading(true);

  const cacheKey = `${title}-${author}-${category}`;
  const cachedAnalysis = loadFromCache(cacheKey);

  if (cachedAnalysis) {
    setAnalysis(cachedAnalysis);
    setIsLoading(false);
    trackAnalysis(category, true);
    setAnalytics(getAnalytics());
    return;
  }

  try {
    if (!CATEGORY_PROMPTS[category]) {
      throw new Error(`Invalid category: ${category}`);
    }

    const prompt = CATEGORY_PROMPTS[category].replace('{title}', title).replace('{author}', author);
    const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("You've exceeded the API rate limit. Please wait and try again later.");
      } else {
        throw new Error(`API request failed with status ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
      throw new Error("Unexpected API response format");
    }

    const newAnalysis = {
      title,
      author,
      category,
      content: data.candidates[0].content.parts[0].text
    };
    setAnalysis(newAnalysis);
    saveToCache(cacheKey, newAnalysis);
    trackAnalysis(category, false);
    setAnalytics(getAnalytics());
  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <ErrorBoundary>
      <div className="App">
        <header>
          <h1>Meta Surfer</h1>
          <h2>The easiest way to know an artistic work</h2>
        </header>
        {error && <p className="error">{error}</p>}
        {isLoading ? (
          <div className="loading">Analyzing... Please wait.</div>
        ) : !analysis ? (
          <InputForm onSubmit={handleAnalysis} />
        ) : (
          <Analysis data={analysis} onReset={() => setAnalysis(null)} />
        )}
        {analytics && (
          <div className="analytics">
            <h3>Usage Statistics</h3>
            <p>Total Analyses: {analytics.cacheHits + analytics.apiCalls}</p>
            <p>Cache Hits: {analytics.cacheHits}</p>
            <p>API Calls: {analytics.apiCalls}</p>
            <h4>Analyses by Category:</h4>
            <ul>
              {Object.entries(analytics.categories).map(([category, count]) => (
                <li key={category}>{category}: {count}</li>
              ))}
            </ul>
          </div>
        )}
        <footer>
          <p>API Limits: 15 RPM, 32,000 TPM, 1,500 RPD</p>
          <p>Meta Surfer is an AI-powered app that can make mistakes. Please double-check the responses.</p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
