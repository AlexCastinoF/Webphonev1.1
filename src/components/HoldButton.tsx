import React from 'react';
import { Pause } from 'lucide-react';
import { Session, SessionState } from 'sip.js';

interface HoldButtonProps {
  session: Session | null;
  isOnHold: boolean;
  setCallState: React.Dispatch<React.SetStateAction<any>>;
}

const HoldButton: React.FC<HoldButtonProps> = ({ session, isOnHold, setCallState }) => {
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const holdAudioTrackRef = React.useRef<MediaStreamTrack | null>(null);
  const originalAudioTrackRef = React.useRef<MediaStreamTrack | null>(null);

  const handleHold = async () => {
    if (session?.state === SessionState.Established) {
      try {
        const audioSender = session.sessionDescriptionHandler
          ?.peerConnection
          ?.getSenders()
          .find((sender) => sender.track?.kind === 'audio');

        if (!originalAudioTrackRef.current && audioSender?.track) {
          // Armazena a trilha original do microfone na primeira execução
          originalAudioTrackRef.current = audioSender.track;
        }

        if (isOnHold) {
          console.log('Unholding call...');
          // Reativa a trilha do microfone
          if (originalAudioTrackRef.current) {
            originalAudioTrackRef.current.enabled = true;
            session.sessionDescriptionHandler.peerConnection.getSenders().forEach((sender) => {
              if (sender.track?.kind === 'audio') {
                sender.replaceTrack(originalAudioTrackRef.current);
              }
            });
          }

          // Para e libera a música de espera
          if (holdAudioTrackRef.current) {
            holdAudioTrackRef.current.stop();
            holdAudioTrackRef.current = null;
          }

          setCallState((prev) => ({ ...prev, isOnHold: false }));
        } else {
          console.log('Holding call...');
          // **Desativa o microfone imediatamente**
          if (originalAudioTrackRef.current) {
            originalAudioTrackRef.current.enabled = false;
          }

          // Cria o contexto de áudio se necessário
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
          }

          const audioContext = audioContextRef.current;
          const audioBuffer = await fetch('https://kvoip.com.br/musicadeespera.mp3')
            .then((response) => response.arrayBuffer())
            .then((buffer) => audioContext.decodeAudioData(buffer));

          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;

          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          source.start();

          // Obtém a trilha de áudio da música de espera
          const holdAudioTrack = destination.stream.getAudioTracks()[0];
          holdAudioTrackRef.current = holdAudioTrack;

          // Substitui a trilha de áudio do microfone pela música de espera
          session.sessionDescriptionHandler.peerConnection.getSenders().forEach((sender) => {
            if (sender.track?.kind === 'audio') {
              sender.replaceTrack(holdAudioTrack);
            }
          });

          setCallState((prev) => ({ ...prev, isOnHold: true }));
        }
      } catch (error) {
        console.error('Error toggling hold:', error);
      }
    } else {
      console.log('Session is not established.');
    }
  };

  return (
    <button
      onClick={handleHold}
      className={`p-2 rounded-full hover:bg-blue-50 ${isOnHold ? 'text-red-600' : 'text-blue-600'}`}
    >
      <Pause className="w-5 h-5" />
    </button>
  );
};

export default HoldButton;
