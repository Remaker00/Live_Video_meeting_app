import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Meeting from './components/Meeting';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/meeting/:meetingId" element={<Meeting />} />
      </Routes>
    </Router>
  );
}

export default App;
