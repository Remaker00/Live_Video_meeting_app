import React, { useCallback, useEffect, useRef, useState } from 'react';
import peer from "./peer";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function VideoControl({ meetingId, name, hostName }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [remoteSocketIds, setRemoteSocketIds] = useState([]);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();

  const handleCallUser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      const offer = await peer.getOffer();

      socket.emit("user:call", { to: remoteSocketIds, offer });
      setMyStream(stream);
      localVideo.current.srcObject = stream;

      console.log('Remote Socket IDs:', remoteSocketIds);
    } catch (err) {
      console.log(err);
    }
  }, [remoteSocketIds]);

  const handleUserJoined = useCallback(({ Name, id }) => {
    setRemoteSocketIds(prevIds => [...prevIds, id]);
  }, [meetingId]);

  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketIds(from);
      console.log(`Incoming Call`, from, offer);

      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    []
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      console.log("Call Accepted!");
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketIds });
  }, [remoteSocketIds]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncoming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    []
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener('track', async (ev) => {
      const [remoteStream] = ev.streams;
      setRemoteStream(remoteStream);
      remoteVideo.current.srcObject = remoteStream;
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncoming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncoming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    handleUserJoined,
    handleIncomingCall,
    handleCallAccepted,
    handleNegoNeedIncoming,
    handleNegoNeedFinal
  ]);

  const handleShareScreen = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      const senders = peer.peer.getSenders();

      // Replace video track for all senders
      senders.forEach(sender => {
        if (sender.track.kind === 'video') {
          sender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => {
        // Revert to the camera stream when the screen sharing stops
        senders.forEach(sender => {
          if (sender.track.kind === 'video') {
            sender.replaceTrack(myStream.getVideoTracks()[0]);
          }
        });
      };

      localVideo.current.srcObject = screenStream;
    } catch (err) {
      console.log('Error sharing screen:', err);
    }
  }, [myStream]);

  return (
    <div className="video-controls">
      <div className="main-video">
        <div className="video-container">
          <div className="video-name">{remoteSocketIds.length ? "Remote Stream" : ""}</div>
          <video
            ref={remoteVideo}
            className="remote-video"
            autoPlay
            playsInline
          />
          {/* <div className="watermark">Presented by: {hostName}</div> */}
        </div>
      </div>
      <div className="local-video-container">
        <div className="video-container">
          <div className="video-name">My Stream</div>
          <video
            ref={localVideo}
            className="local-video"
            autoPlay
            playsInline
          />
        </div>
      </div>
      <div className="controls">
        {myStream && <button onClick={sendStreams}>Send Stream</button>}
        <button onClick={handleCallUser}>Turn On Camera</button>
        <button onClick={handleShareScreen}>Present</button>
      </div>
    </div>
  );
}

export default VideoControl;