export interface SipConfig {
  username: string;
  password: string;
  domain: string;
  proxy: string;
  ramal_number: string;
  protocolo: string;
  executaAudioDeEncerramentoDeChamada: number;
  autoAtendimento: string;
  authorizationHa1: string;
}

export interface CallState {
  isRegistered: boolean;
  isRegistering: boolean;
  isInCall: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  currentNumber: string;
  incomingCall: boolean;
  incomingCallNumber: string;
  callStatus: string;
  callStartTime: number | null;
  ringingStartTime: number | null;
}