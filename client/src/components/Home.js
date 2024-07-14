import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Home() {
  const [name, setName] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const navigate = useNavigate();

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleMeetingIdChange = (event) => {
    setMeetingId(event.target.value);
  };

  const generateRandomMeetingId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  const handleJoinMeeting = () => {
    if (name.trim() === '') {
      alert('Please enter your name');
      return;
    }
    if (meetingId.trim() === '') {
      alert('Please enter a meeting ID');
      return;
    }
    localStorage.setItem('name', name);
    localStorage.setItem('host', false);
    navigate(`/meeting/${meetingId}`);
  };

  const handleCreateMeeting = async () => {
    if (name.trim() === '') {
      alert('Please enter your name');
      return;
    }

    const newMeetingId = generateRandomMeetingId();
    const startTime = new Date().toISOString();

    try {
      const response = await axios.post('http://localhost:5000/api/meetings/create', {
        hostName: name,
        meetingId: newMeetingId,
        startTime,
      });

      localStorage.setItem('name', name);
      localStorage.setItem('host', true);
      navigate(`/meeting/${newMeetingId}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
    }
  };

  return (
    <div className="App">
      <h1>Meeting App</h1>
      <div className="input-container">
        <label>Enter your name:</label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Enter your name"
        />
      </div>
      <div className="input-container">
        <label>Enter meeting ID:</label>
        <input
          type="text"
          value={meetingId}
          onChange={handleMeetingIdChange}
          placeholder="Enter meeting ID"
        />
      </div>
      <div className="button-container">
        <button onClick={handleJoinMeeting}>Join Meeting</button>
        <button onClick={handleCreateMeeting}>Create New Meeting</button>
      </div>
    </div>
  );
}

export default Home;
