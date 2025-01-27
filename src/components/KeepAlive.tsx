import React, { useEffect, useRef } from 'react';
import { Registerer, RegistererState } from 'sip.js';

interface KeepAliveProps {
  registerer: Registerer | null;
}

const KeepAlive: React.FC<KeepAliveProps> = ({ registerer }) => {
  useEffect(() => {
    const registerExtension = () => {
      if (registerer && registerer.state !== RegistererState.Registered) {
        console.log('🟡 Registrando ramal:', registerer);
        registerer.register().catch((error) => {
          console.error('Error renewing registration:', error);
        });
      }
    };

    const sendKeepAlive = () => {
      if (registerer && registerer.state === RegistererState.Registered) {
        console.log('🔵 Enviando keep-alive para a sessão:', registerer);
        // Adicione aqui a lógica para enviar uma mensagem de keep-alive
      }
    };

    // Registrar o ramal inicialmente
    registerExtension();

    // Configurar um intervalo para renovar o registro periodicamente
    const registerIntervalId = setInterval(registerExtension, 250000); // 250 segundos

    // Configurar um intervalo para enviar mensagens de keep-alive periodicamente
    const keepAliveIntervalId = setInterval(sendKeepAlive, 30000); // 30 segundos

    // Limpar os intervalos quando o componente for desmontado
    return () => {
      clearInterval(registerIntervalId);
      clearInterval(keepAliveIntervalId);
    };
  }, [registerer]);

  return null;
};

export default KeepAlive;