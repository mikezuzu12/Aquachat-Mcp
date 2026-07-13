import { useEffect, useRef, useState, useCallback } from "react";
import { sendCallSignal, subscribeToCallSignals, updateCallStatus } from "../services/callService";
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

interface UseWebRTCProps {
  callId: string;
  userId: string;
  remoteUserId: string;
  isCaller: boolean;
  isVideo: boolean;
  onCallEnded: () => void;
}

interface Signal {
  type: string;
  payload: any;
  from_user_id: string;
}

export function useWebRTC({ 
  callId, 
  userId, 
  remoteUserId, 
  isCaller, 
  isVideo, 
  onCallEnded 
}: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState("");
  const [isCallEnded, setIsCallEnded] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ── Check if devices are available ─────────────────────────────────────
  const checkDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(d => d.kind === 'audioinput');
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      
      console.log('Available devices:', devices);
      console.log('Has audio:', hasAudio);
      console.log('Has video:', hasVideo);
      
      if (!hasAudio) {
        setError("No microphone found. Please connect a microphone.");
        return false;
      }
      
      if (isVideo && !hasVideo) {
        setError("No camera found. Please connect a camera.");
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error checking devices:', err);
      return false;
    }
  }, [isVideo]);

  const setupPeerConnection = useCallback((stream: MediaStream) => {
    const peer = new RTCPeerConnection({
      ...ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });
    peerRef.current = peer;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    const remote = new MediaStream();
    setRemoteStream(remote);
    
    peer.ontrack = (e) => {
      e.streams[0].getTracks().forEach((track) => {
        remote.addTrack(track);
      });
    };

    peer.onicecandidate = async (e) => {
      if (e.candidate) {
        try {
          await sendCallSignal({
            callId,
            fromUserId: userId,
            toUserId: remoteUserId,
            type: "ice-candidate",
            payload: e.candidate,
          });
        } catch (err) {
          console.error("Failed to send ICE candidate:", err);
        }
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peer.iceConnectionState);
      if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
        setIsConnected(true);
      }
      if (peer.iceConnectionState === "disconnected" || peer.iceConnectionState === "failed") {
        setIsConnected(false);
        if (!isCallEnded) {
          handleEndCall();
        }
      }
    };

    return peer;
  }, [callId, userId, remoteUserId]);

  const handleEndCall = useCallback(async () => {
    if (isCallEnded) return;
    setIsCallEnded(true);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);

    try {
      await sendCallSignal({ 
        callId, 
        fromUserId: userId, 
        toUserId: remoteUserId, 
        type: "end", 
        payload: {} 
      });
    } catch (err) {
      console.error("Failed to send end signal:", err);
    }

    try {
      await updateCallStatus(callId, "ended");
    } catch (err) {
      console.error("Failed to update call status:", err);
    }

    onCallEnded();
  }, [callId, userId, remoteUserId, onCallEnded, isCallEnded]);

  const startCall = useCallback(async () => {
    try {
      const devicesReady = await checkDevices();
      if (!devicesReady) return;

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo ? {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      };

      console.log('Starting call with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got local stream with tracks:', stream.getTracks().map(t => ({ kind: t.kind })));
      
      localStreamRef.current = stream;
      setLocalStream(stream);

      const peer = setupPeerConnection(stream);
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      await peer.setLocalDescription(offer);
      
      await sendCallSignal({ 
        callId, 
        fromUserId: userId, 
        toUserId: remoteUserId, 
        type: "offer", 
        payload: offer 
      });
    } catch (err) {
      console.error('Error starting call:', err);
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          setError("No microphone or camera found. Please connect a device.");
        } else if (err.name === 'NotAllowedError') {
          setError("Permission denied. Please allow access to your microphone and camera.");
        } else {
          setError(`Failed to access media: ${err.message}`);
        }
      } else {
        setError("Failed to access media devices.");
      }
    }
  }, [callId, userId, remoteUserId, isVideo, setupPeerConnection, checkDevices]);

  const answerCall = useCallback(async (offer: any, fromUserId: string) => {
    try {
      const devicesReady = await checkDevices();
      if (!devicesReady) return;

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo ? {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      };

      console.log('Answering call with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got local stream for answer:', stream.getTracks().map(t => ({ kind: t.kind })));
      
      localStreamRef.current = stream;
      setLocalStream(stream);

      const peer = setupPeerConnection(stream);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      await peer.setLocalDescription(answer);
      
      await sendCallSignal({ 
        callId, 
        fromUserId: userId, 
        toUserId: fromUserId, 
        type: "answer", 
        payload: answer 
      });
    } catch (err) {
      console.error('Error answering call:', err);
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          setError("No microphone or camera found. Please connect a device.");
        } else if (err.name === 'NotAllowedError') {
          setError("Permission denied. Please allow access to your microphone and camera.");
        } else {
          setError(`Failed to access media: ${err.message}`);
        }
      } else {
        setError("Failed to access media devices.");
      }
    }
  }, [callId, userId, isVideo, setupPeerConnection, checkDevices]);

  const endCall = useCallback(async () => {
    await handleEndCall();
  }, [handleEndCall]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { 
      t.enabled = !t.enabled; 
    });
    setIsMuted((v) => !v);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { 
      t.enabled = !t.enabled; 
    });
    setIsCameraOff((v) => !v);
  }, []);

  // ── Subscribe to signals ──────────────────────────────────────────────────
  useEffect(() => {
    if (!callId) return;

    const unsubscribe = subscribeToCallSignals(callId, userId, async (signal: Signal) => {
      console.log('Received signal:', signal.type);
      const peer = peerRef.current;

      if (signal.type === "offer" && !isCaller) {
        await answerCall(signal.payload, signal.from_user_id);
      }

      if (signal.type === "answer" && peer) {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
        } catch (err) {
          console.error("Failed to set remote description:", err);
        }
      }

      if (signal.type === "ice-candidate" && peer) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(signal.payload));
        } catch (err) {
          console.error("Failed to add ICE candidate:", err);
        }
      }

      if (signal.type === "end") {
        if (!isCallEnded) {
          localStreamRef.current?.getTracks().forEach((t) => t.stop());
          peerRef.current?.close();
          setIsCallEnded(true);
          onCallEnded();
        }
      }
    });

    unsubscribeRef.current = unsubscribe;
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [callId, userId, isCaller, answerCall, onCallEnded, isCallEnded]);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    localStream,
    remoteStream,
    isConnected,
    isMuted,
    isCameraOff,
    error,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}