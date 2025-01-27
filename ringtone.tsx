import { useEffect, useRef } from 'react';

class RingToneManager {
  private audio: HTMLAudioElement;
  private callAudio: HTMLAudioElement;
  private interval: NodeJS.Timeout | null = null;
  private isPlaying = false;

  constructor() {
    this.audio = new Audio('https://kvoip.com.br/ring.mp3');
    this.callAudio = new Audio('https://kvoip.com.br/toquedechamada.mp3');
    this.audio.load();
    this.callAudio.load();
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const playSequence = () => {
      this.audio.currentTime = 0;
      this.audio.play().catch(console.error);
      
      setTimeout(() => {
        this.audio.pause();
      }, 2000);
    };

    // Primeira execução imediata
    playSequence();

    // Configura o intervalo para repetir o padrão a cada 3 segundos (2s tocando + 1s pausa)
    this.interval = setInterval(playSequence, 3000);
  }

  stop() {
    if (!this.isPlaying) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
  }

  startCallTone() {
    this.callAudio.currentTime = 0;
    this.callAudio.play().catch(console.error);
  }

  stopCallTone() {
    this.callAudio.pause();
    this.callAudio.currentTime = 0;
  }
}

// Hook personalizado para usar o RingToneManager
export const useRingTone = (isRinging: boolean, isIncomingCall: boolean) => {
  const managerRef = useRef<RingToneManager | null>(null);

  useEffect(() => {
    // Cria uma única instância do manager
    if (!managerRef.current) {
      managerRef.current = new RingToneManager();
    }

    // Inicia ou para o tom de acordo com o estado
    if (isRinging) {
      managerRef.current.start();
    } else {
      managerRef.current.stop();
    }

    // Inicia ou para o tom de chamada recebida
    if (isIncomingCall) {
      managerRef.current.startCallTone();
    } else {
      managerRef.current.stopCallTone();
    }

    // Cleanup ao desmontar
    return () => {
      if (managerRef.current) {
        managerRef.current.stop();
        managerRef.current.stopCallTone();
      }
    };
  }, [isRinging, isIncomingCall]);
};

export default RingToneManager;