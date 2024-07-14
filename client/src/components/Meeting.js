import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from "socket.io-client";
import VideoControl from './VideoControl';

const socket = io("http://localhost:5000");

function Meeting() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [hostName, setHostName] = useState('');
  const name = localStorage.getItem('name');

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/meetings/${meetingId}`);
        const meeting = response.data;
        setHostName(meeting.hostName);

        const participantExists = meeting.participants.some(participant => participant.name === name);

        if (!participantExists) {
          const newParticipant = { name, video: false, mic: false };
          const updatedParticipants = [...meeting.participants, newParticipant];
          setParticipants(updatedParticipants);

          await axios.put(`http://localhost:5000/api/meetings/${meetingId}`, {
            participants: updatedParticipants,
          });
        } else {
          setParticipants(meeting.participants);
        }
      } catch (error) {
        console.error('Error fetching meeting details:', error);
      }
    };

    fetchMeetingDetails();

    socket.emit("room:join", { Name: name, room: meetingId });
    socket.on("participants:update", (updatedParticipants) => {
      setParticipants(updatedParticipants);
    });

    socket.on("kicked", () => {
      alert("You have been kicked from the meeting.");
      navigate("/"); // Redirect to home or another page
    });

    console.log(meetingId);

    return () => {
      socket.off("participants:update");
      socket.off("kicked");
    };
  }, [meetingId, name, navigate]);

  const handleKickParticipant = async (participantName) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/meetings/${meetingId}`);
      const meeting = response.data;
      const updatedParticipants = meeting.participants.filter(participant => participant.name !== participantName);

      await axios.put(`http://localhost:5000/api/meetings/${meetingId}`, {
        participants: updatedParticipants,
      });

      socket.emit("participant:kick", { participantName, room: meetingId });
    } catch (error) {
      console.error('Error kicking participant:', error);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      console.log('Protection');
      // Prevent certain key combinations that might trigger screenshots or recordings
      if ((event.ctrlKey && event.key === 'PrintScreen') ||  // Ctrl + Print Screen
        (event.metaKey && event.key === 'Shift') ||        // Meta (Cmd) + Shift
        (event.altKey && event.key === 'PrintScreen')) {   // Alt + Print Screen
        event.preventDefault();
        console.log('Screen capture prevented');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Show backdrop effect or prevent switching away
        document.body.classList.add('sensitive-content');
      } else {
        // Hide backdrop effect
        document.body.classList.remove('sensitive-content');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="meeting-container full-screen">
      <div className="participants">
        <h2>Participants</h2>
        {participants.map((participant, index) => (
          <div key={index} className="participant">
            <div className="avatar">{participant.name.charAt(0).toUpperCase()}</div>
            <div className="name">
              {participant.name} {participant.name === hostName ? '(host)' : ''}
              {name === hostName && participant.name !== hostName && (
                <button onClick={() => handleKickParticipant(participant.name)}>Kick</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <VideoControl meetingId={meetingId} name={name} hostName={hostName} />
    </div>
  );
}

export default Meeting;
