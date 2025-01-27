import React from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isInCall: boolean;
  onMute: () => void;
  onEndCall: () => void;
  onAcceptCall: () => void;
  onRejectCall: () => void;
}

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isInCall,
  onMute,
  onEndCall,
  onAcceptCall,
  onRejectCall,
}) => {
  return (
    <div className="call-controls">
      {!isInCall && (
        <>
          <button onClick={onAcceptCall}>
            <Phone className="icon accept" />
          </button>
          <button onClick={onRejectCall}>
            <PhoneOff className="icon reject" />
          </button>
        </>
      )}
      {isInCall && (
        <>
          <button onClick={onMute}>
            {isMuted ? <MicOff className="icon muted" /> : <Mic className="icon unmuted" />}
          </button>
          <button onClick={onEndCall}>
            <PhoneOff className="icon end" />
          </button>
        </>
      )}
    </div>
  );
};

export default CallControls;
