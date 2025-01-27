import React, { useState, useEffect, useRef } from 'react';
import { UserAgent, RegistererState, SessionState, Registerer, URI, Inviter, Session, Invitation } from 'sip.js';
import { Phone, PhoneOff, Mic, MicOff, Pause, Settings, Copy, Circle, PhoneIncoming } from 'lucide-react';
import { SipConfig, CallState } from '../types/sipConfig';
import { useRingTone } from './ringtone';
import HoldButton from './HoldButton';

const defaultConfig: SipConfig = {
  username: '',
  password: '',
  domain: '',
  proxy: 'webrtc.dazsoft.com:8080',
  ramal_number: '',
  protocolo: 'wss://',
  executaAudioDeEncerramentoDeChamada: 0,
  autoAtendimento: '0',
  authorizationHa1: ''
};

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const WebSoftphone: React.FC = () => {
  const [config, setConfig] = useState<SipConfig>(() => {
    const saved = localStorage.getItem('sipConfig');
    return saved ? JSON.parse(saved) : defaultConfig;
  });
  
  const [callState, setCallState] = useState<CallState>({
    isRegistered: false,
    isRegistering: false,
    isInCall: false,
    isMuted: false,
    isOnHold: false,
    currentNumber: '',
    incomingCall: false,
    incomingCallNumber: '',
    callStatus: '',
    callStartTime: null,
    ringingStartTime: null
  });

  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [ringingTime, setRingingTime] = useState<string>('00:00');
  const timerRef = useRef<number>();
  const ringingTimerRef = useRef<number>();

  const [showSettings, setShowSettings] = useState(false);
  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const invitationRef = useRef<Invitation | null>(null);
  const [statusColor, setStatusColor] = useState<string>('text-red-500');
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [isRinging, setIsRinging] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const registerIntervalRef = useRef<number>();
  const holdAudioRef = useRef<HTMLAudioElement>(new Audio('https://kvoip.com.br/musicadeespera.mp3'));

  useEffect(() => {
    if (config.username && config.password && config.domain) {
      initializeSIP();
    }
    return () => {
      cleanupSession();
      if (registererRef.current) {
        registererRef.current.unregister();
      }
      if (userAgentRef.current) {
        userAgentRef.current.stop();
      }
      if (registerIntervalRef.current) {
        clearInterval(registerIntervalRef.current);
      }
    };
  }, [config]);

  useEffect(() => {
    if (callState.callStartTime) {
      const updateTimer = () => {
        const elapsed = Date.now() - callState.callStartTime!;
        setElapsedTime(formatTime(elapsed));
      };
      updateTimer();
      timerRef.current = window.setInterval(updateTimer, 1000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    } else {
      setElapsedTime('00:00');
    }
  }, [callState.callStartTime]);

  useEffect(() => {
    if (callState.ringingStartTime) {
      const updateRingingTimer = () => {
        const elapsed = Date.now() - callState.ringingStartTime!;
        setRingingTime(formatTime(elapsed));
      };
      updateRingingTimer();
      ringingTimerRef.current = window.setInterval(updateRingingTimer, 1000);
      return () => {
        if (ringingTimerRef.current) {
          clearInterval(ringingTimerRef.current);
        }
      };
    } else {
      setRingingTime('00:00');
    }
  }, [callState.ringingStartTime]);

  useEffect(() => {
    if (callState.callStatus === 'Chamando...') {
      setIsRinging(true);
    } else {
      setIsRinging(false);
    }
  }, [callState.callStatus]);

  useEffect(() => {
    setIsIncomingCall(callState.incomingCall);
  }, [callState.incomingCall]);

  useRingTone(isRinging, isIncomingCall);

  useEffect(() => {
    holdAudioRef.current.load();
  }, []);

  const cleanupSession = () => {
    if (sessionRef.current) {
      try {
        if (sessionRef.current.state !== SessionState.Terminated) {
          sessionRef.current.bye();
        }
      } catch (error) {
        console.error('Error cleaning up session:', error);
      }
      sessionRef.current = null;
    }
    if (invitationRef.current) {
      try {
        if (invitationRef.current.state !== SessionState.Terminated) {
          invitationRef.current.reject();
        }
      } catch (error) {
        console.error('Error rejecting invitation:', error);
      }
      invitationRef.current = null;
    }

    // Clear all timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (ringingTimerRef.current) {
      clearInterval(ringingTimerRef.current);
    }

    // Stop hold music
    if (holdAudioRef.current) {
      holdAudioRef.current.pause();
      holdAudioRef.current.currentTime = 0;
    }

    setCallState(prev => ({
      ...prev,
      isInCall: false,
      isMuted: false,
      isOnHold: false,
      incomingCall: false,
      incomingCallNumber: '',
      callStatus: '',
      callStartTime: null,
      ringingStartTime: null
    }));

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const setupRemoteMedia = (session: Session) => {
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler || !('peerConnection' in sessionDescriptionHandler)) {
      console.error('Session description handler not found');
      return;
    }

    const peerConnection = (sessionDescriptionHandler as any).peerConnection;
    
    if (remoteAudioRef.current && peerConnection) {
      const remoteStream = new MediaStream();
      peerConnection.getReceivers().forEach((receiver: RTCRtpReceiver) => {
        if (receiver.track) {
          remoteStream.addTrack(receiver.track);
        }
      });
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(error => {
        console.error('Error playing remote audio:', error);
      });
    }
  };

  const initializeSIP = async () => {
    try {
      if (!config.username || !config.password || !config.domain) {
        throw new Error('Missing required configuration');
      }

      console.log('Initializing SIP connection...', { config });
      setCallState(prev => ({ ...prev, isRegistering: true }));
      setStatusColor('text-yellow-500');

      const uri = UserAgent.makeURI(`sip:${config.username}@${config.domain}`);
      if (!uri) {
        throw new Error('Failed to create URI');
      }

      const wsServer = `${config.protocolo}${config.proxy}`;

      const userAgent = new UserAgent({
        uri,
        transportOptions: {
          server: wsServer,
          traceSip: true,
          wsServers: [wsServer]
        },
        authorizationUsername: config.username,
        authorizationPassword: config.password,
        displayName: config.username,
        contactName: config.username,
        noAnswerTimeout: 60,
        hackIpInContact: true,
        logLevel: 'debug',
        logConnector: console.log,
        sessionDescriptionHandlerFactoryOptions: {
          constraints: {
            audio: true,
            video: false
          },
          peerConnectionOptions: {
            rtcConfiguration: {
              iceServers: [
                { urls: ['stun:stun.l.google.com:19302'] }
              ]
            }
          }
        }
      });

      userAgentRef.current = userAgent;

      userAgent.delegate = {
        onInvite: (invitation) => {
          console.log('Incoming call received');
          
          cleanupSession();
          
          invitationRef.current = invitation;
          const fromNumber = invitation.remoteIdentity.uri.user;
          setCallState(prev => ({ 
            ...prev, 
            incomingCall: true,
            incomingCallNumber: fromNumber || '',
            ringingStartTime: Date.now(),
            callStatus: 'Chamada recebida'
          }));

          invitation.stateChange.addListener((state: SessionState) => {
            console.log('Incoming call state changed:', state);
            if (state === SessionState.Establishing) {
              setCallState(prev => ({ ...prev, callStatus: 'Conectando...' }));
            } else if (state === SessionState.Established) {
              sessionRef.current = invitation;
              setupRemoteMedia(invitation);
              setCallState(prev => ({ 
                ...prev, 
                isInCall: true,
                incomingCall: false,
                incomingCallNumber: '',
                callStatus: 'Chamada conectada',
                callStartTime: Date.now(),
                ringingStartTime: null
              }));
            } else if (state === SessionState.Terminated) {
              cleanupSession();
            }
          });
        }
      };

      userAgent.transport.onConnect = async () => {
        console.log('Transport connected');
        try {
          const registerer = new Registerer(userAgent, {
            expires: 300,
            extraHeaders: ['X-oauth-dazsoft: 1'],
            regId: 1,
            params: {
              'transport': 'ws'
            }
          });

          registererRef.current = registerer;

          registerer.stateChange.addListener((newState: RegistererState) => {
            console.log('Registerer state changed:', newState);
            switch (newState) {
              case RegistererState.Registered:
                setCallState(prev => ({ ...prev, isRegistered: true, isRegistering: false }));
                setStatusColor('text-green-500');
                requestMediaPermissions();
                break;
              case RegistererState.Unregistered:
              case RegistererState.Terminated:
                setCallState(prev => ({ ...prev, isRegistered: false, isRegistering: false }));
                setStatusColor('text-red-500');
                cleanupSession();
                break;
            }
          });

          await registerer.register();
          console.log('Registration request sent');

          // Set interval to renew registration
          registerIntervalRef.current = window.setInterval(() => {
            if (registererRef.current) {
              registererRef.current.register().catch((error) => {
                console.error('Error renewing registration:', error);
              });
            }
          }, 270000); // Renew registration every 4.5 minutes (270000 ms)

        } catch (error) {
          console.error('Registration error:', error);
          setStatusColor('text-red-500');
          setCallState(prev => ({ ...prev, isRegistered: false, isRegistering: false }));
        }
      };

      userAgent.transport.onDisconnect = (error?: Error) => {
        console.log('Transport disconnected', error);
        setStatusColor('text-red-500');
        setCallState(prev => ({ ...prev, isRegistered: false, isRegistering: false }));
        cleanupSession();
      };

      await userAgent.start();
      console.log('UserAgent started');

    } catch (error) {
      console.error('SIP initialization error:', error);
      setStatusColor('text-red-500');
      setCallState(prev => ({ ...prev, isRegistered: false, isRegistering: false }));
    }
  };

  const requestMediaPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Media permissions granted');
    } catch (error) {
      console.error('Media permissions error:', error);
    }
  };

  const handleCall = async () => {
    if (!callState.currentNumber || !userAgentRef.current || callState.isInCall) return;

    try {
      cleanupSession();
      setCallState(prev => ({ 
        ...prev, 
        callStatus: 'Iniciando chamada...',
        ringingStartTime: Date.now()
      }));

      const target = UserAgent.makeURI(`sip:${callState.currentNumber}@${config.domain}`);
      if (!target) {
        throw new Error('Failed to create target URI');
      }
      
      const inviter = new Inviter(userAgentRef.current, target, {
        extraHeaders: ['X-oauth-dazsoft: 1'],
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });
      
      inviter.stateChange.addListener((state: SessionState) => {
        console.log('Call state changed:', state);
        if (state === SessionState.Establishing) {
          setCallState(prev => ({ 
            ...prev, 
            callStatus: 'Chamando...',
            ringingStartTime: prev.ringingStartTime || Date.now()
          }));
        } else if (state === SessionState.Established) {
          sessionRef.current = inviter;
          setupRemoteMedia(inviter);
          setCallState(prev => ({ 
            ...prev, 
            isInCall: true,
            callStatus: 'Chamada conectada',
            callStartTime: Date.now(),
            ringingStartTime: null
          }));
        } else if (state === SessionState.Terminated) {
          cleanupSession();
        }
      });

      await inviter.invite();

    } catch (error) {
      console.error('Call error:', error);
      cleanupSession();
    }
  };

  const handleAcceptCall = async () => {
    if (!invitationRef.current) return;

    try {
      setCallState(prev => ({ 
        ...prev, 
        callStatus: 'Aceitando chamada...',
        ringingStartTime: null,
        callStartTime: Date.now()
      }));

      await invitationRef.current.accept({
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });

      setupRemoteMedia(invitationRef.current);
    } catch (error) {
      console.error('Error accepting call:', error);
      cleanupSession();
    }
  };

  const handleRejectCall = () => {
    if (!invitationRef.current) return;

    try {
      invitationRef.current.reject();
      cleanupSession();
    } catch (error) {
      console.error('Error rejecting call:', error);
      cleanupSession();
    }
  };

  const handleEndCall = () => {
    cleanupSession();
  };

  const handleMute = () => {
    if (sessionRef.current?.state === SessionState.Established) {
      try {
        const audioTrack = sessionRef.current.sessionDescriptionHandler
          ?.peerConnection
          ?.getSenders()
          .find((sender: any) => sender.track?.kind === 'audio');
        
        if (audioTrack?.track) {
          audioTrack.track.enabled = callState.isMuted;
          setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
        }
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  };

  const handleCopyEmbedCode = () => {
    const embedCode = `<iframe src="YOUR_DEPLOYMENT_URL" width="400" height="100" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
  };

  const saveConfig = (newConfig: SipConfig) => {
    localStorage.setItem('sipConfig', JSON.stringify(newConfig));
    setConfig(newConfig);
    setShowSettings(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-md w-full mx-auto">
      <audio ref={remoteAudioRef} autoPlay />
      
      <div className="flex flex-col gap-4">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Circle className={`w-4 h-4 ${statusColor}`} />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {callState.isRegistered ? "Online" : callState.isRegistering ? "Registering" : "Offline"}
              </div>
            </div>
            
            {/* Call status message */}
            {callState.callStatus && (
              <span className="text-sm text-gray-600">
                {callState.callStatus}
              </span>
            )}
          </div>

          {/* Timer display */}
          {(callState.callStartTime || callState.ringingStartTime) && (
            <span className="text-sm font-mono">
              {callState.callStartTime ? elapsedTime : ringingTime}
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="flex flex-wrap items-center gap-2">
          {callState.incomingCall ? (
            <>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <PhoneIncoming className="w-5 h-5 text-blue-600 animate-pulse flex-shrink-0" />
                <span className="text-sm truncate">
                  Chamada recebida de: <strong>{callState.incomingCallNumber}</strong>
                </span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button 
                  onClick={handleAcceptCall}
                  className="p-2 rounded-full bg-green-100 hover:bg-green-200 text-green-600"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleRejectCall}
                  className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Enter number"
                value={callState.currentNumber}
                onChange={(e) => !callState.isInCall && setCallState(prev => ({ ...prev, currentNumber: e.target.value }))}
                disabled={callState.isInCall}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />

              <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                <button 
                  onClick={handleCall}
                  disabled={!callState.isRegistered || callState.isInCall || Boolean(callState.callStatus)}
                  className="p-2 rounded-full hover:bg-blue-50 text-blue-600 disabled:text-gray-400 disabled:hover:bg-transparent"
                >
                  <Phone className="w-5 h-5" />
                </button>

                {callState.isInCall && (
                  <>
                    <button 
                      onClick={handleMute} 
                      className={`p-2 rounded-full hover:bg-blue-50 ${callState.isMuted ? 'text-red-600' : 'text-blue-600'}`}
                    >
                      {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    
                    <HoldButton 
                      session={sessionRef.current} 
                      holdAudioRef={holdAudioRef} 
                      isOnHold={callState.isOnHold} 
                      setCallState={setCallState} 
                    />
                    
                    <button 
                      onClick={handleEndCall} 
                      className="p-2 rounded-full hover:bg-red-50 text-red-600"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  </>
                )}

                <button 
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                >
                  <Settings className="w-5 h-5" />
                </button>

                <button 
                  onClick={handleCopyEmbedCode}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={config.username}
                  onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={config.password}
                  onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  value={config.domain}
                  onChange={(e) => setConfig(prev => ({ ...prev, domain: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ramal Number
                </label>
                <input
                  type="text"
                  value={config.ramal_number}
                  onChange={(e) => setConfig(prev => ({ ...prev, ramal_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => saveConfig(config)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebSoftphone;