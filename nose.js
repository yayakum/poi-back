// =========== INICIO: FUNCIONALIDAD DE VIDEOLLAMADA ===========
    
    // Iniciar una videollamada
    socket.on('initiateVideoCall', async (data) => {
        const { callerId, callerName, receiverId, isVideo } = data;
        
        // Verificar si el receptor está en línea
        const receiverSocketId = userSockets[receiverId];
        if (!receiverSocketId) {
          return socket.emit('videoCallError', { 
            error: 'El usuario no está disponible en este momento' 
          });
        }
        
        // Crear ID único para la llamada
        const callId = `call-${Date.now()}-${callerId}-${receiverId}`;
        
        // Registrar la llamada como activa
        activeVideoCalls[callId] = {
          callerId,
          receiverId,
          status: 'ringing',
          startTime: Date.now(),
          isVideo
        };
        
        // Notificar al receptor sobre la llamada entrante
        io.to(receiverSocketId).emit('incomingCall', {
          callId,
          callerId,
          callerName,
          isVideo
        });
        
        // Notificar al llamante que la llamada está sonando
        socket.emit('callRinging', { callId });
        
        console.log(`Llamada iniciada: ${callerId} -> ${receiverId} (${callId})`);
        
        // Establecer un tiempo límite para la llamada (30 segundos)
        setTimeout(() => {
          if (activeVideoCalls[callId] && activeVideoCalls[callId].status === 'ringing') {
            delete activeVideoCalls[callId];
            
            // Notificar al llamante que nadie respondió
            socket.emit('callEnded', { 
              callId, 
              reason: 'no-answer'
            });
            
            console.log(`Llamada ${callId} no contestada, cancelada automáticamente`);
          }
        }, 30000);
      });
      
      // Aceptar una videollamada
      socket.on('acceptCall', (data) => {
        const { callId, receiverId } = data;
        
        // Verificar que la llamada existe y está en estado "ringing"
        if (!activeVideoCalls[callId] || activeVideoCalls[callId].status !== 'ringing') {
          return socket.emit('videoCallError', { 
            error: 'Esta llamada ya no está activa' 
          });
        }
        
        const call = activeVideoCalls[callId];
        const callerSocketId = userSockets[call.callerId];
        
        if (!callerSocketId) {
          return socket.emit('videoCallError', { 
            error: 'El llamante ya no está disponible' 
          });
        }
        
        // Actualizar estado de la llamada
        activeVideoCalls[callId].status = 'active';
        
        // Notificar al llamante que la llamada fue aceptada
        io.to(callerSocketId).emit('callAccepted', { 
          callId,
          receiverId
        });
        
        console.log(`Llamada ${callId} aceptada por ${receiverId}`);
      });
      
      // Rechazar una videollamada
      socket.on('rejectCall', (data) => {
        const { callId, receiverId } = data;
        
        // Verificar que la llamada existe
        if (!activeVideoCalls[callId]) {
          return;
        }
        
        const call = activeVideoCalls[callId];
        const callerSocketId = userSockets[call.callerId];
        
        // Notificar al llamante que la llamada fue rechazada
        if (callerSocketId) {
          io.to(callerSocketId).emit('callRejected', { 
            callId, 
            receiverId 
          });
        }
        
        // Eliminar la llamada de las activas
        delete activeVideoCalls[callId];
        
        console.log(`Llamada ${callId} rechazada por ${receiverId}`);
      });
      
      // Finalizar una videollamada
      socket.on('endCall', (data) => {
        const { callId, userId } = data;
        
        // Verificar que la llamada existe
        if (!activeVideoCalls[callId]) {
          return;
        }
        
        const call = activeVideoCalls[callId];
        const otherUserId = call.callerId === userId ? call.receiverId : call.callerId;
        const otherUserSocketId = userSockets[otherUserId];
        
        // Notificar al otro usuario que la llamada terminó
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit('callEnded', { 
            callId, 
            reason: 'ended-by-peer' 
          });
        }
        
        // Eliminar la llamada de las activas
        delete activeVideoCalls[callId];
        
        console.log(`Llamada ${callId} finalizada por ${userId}`);
      });
      
      // Señalización de WebRTC
      socket.on('rtcSignal', (data) => {
        const { callId, signal, to } = data;
        
        // Verificar que la llamada existe y está activa
        if (!activeVideoCalls[callId] || activeVideoCalls[callId].status !== 'active') {
          return;
        }
        
        const targetSocketId = userSockets[to];
        if (targetSocketId) {
          io.to(targetSocketId).emit('rtcSignal', {
            callId,
            signal,
            from: authenticatedUserId
          });
        }
      });
      
      // =========== FIN: FUNCIONALIDAD DE VIDEOLLAMADA ===========