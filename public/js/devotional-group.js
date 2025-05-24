import { db } from './firebase.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    orderBy, 
    query, 
    where,
    serverTimestamp,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

class DevotionalGroupManager {
    constructor() {
        this.auth = getAuth();
        this.selectedUsers = new Set();
        this.onlineUsers = new Map();
        this.activeRooms = new Map();
        this.currentUser = null;
        this.currentRoomId = null;
        this.roomMessageListener = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.startPresenceSystem();
    }

    initializeElements() {
        this.onlineUsersContainer = document.getElementById('onlineUsers');
        this.selectedUsersContainer = document.getElementById('selectedUsers');
        this.devotionalForm = document.getElementById('devotionalForm');
        this.createBtn = document.getElementById('createDevotionalBtn');
        this.clearBtn = document.getElementById('clearSelectionBtn');
        this.activeRoomsContainer = document.getElementById('activeRooms');
        
        // Elementos do modal da sala
        this.roomModal = document.getElementById('devotionalRoomModal');
        this.roomTitle = document.getElementById('roomTitle');
        this.roomPassage = document.getElementById('roomPassage');
        this.roomCreator = document.getElementById('roomCreator');
        this.roomMessages = document.getElementById('roomMessages');
        this.roomChatForm = document.getElementById('roomChatForm');
        this.roomChatInput = document.getElementById('roomChatInput');
        this.roomParticipants = document.getElementById('roomParticipants');
        this.roomBookChapter = document.getElementById('roomBookChapter');
        this.roomDescription = document.getElementById('roomDescription');
        this.closeRoomModalBtn = document.getElementById('closeRoomModal');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        this.shareRoomBtn = document.getElementById('shareRoomBtn');
        this.deleteRoomBtn = document.getElementById('deleteRoomBtn');
    }

    setupEventListeners() {
        // Formulário de criação
        this.devotionalForm?.addEventListener('submit', (e) => this.createDevotionalRoom(e));
        
        // Botão limpar seleção
        this.clearBtn?.addEventListener('click', () => this.clearSelection());

        // Modal da sala
        this.closeRoomModalBtn?.addEventListener('click', () => this.closeRoomModal());
        this.roomChatForm?.addEventListener('submit', (e) => this.sendRoomMessage(e));
        this.leaveRoomBtn?.addEventListener('click', () => this.leaveRoom());
        this.shareRoomBtn?.addEventListener('click', () => this.shareRoom());
        this.deleteRoomBtn?.addEventListener('click', () => this.deleteRoom());

        // Fechar modal ao clicar fora
        this.roomModal?.addEventListener('click', (e) => {
            if (e.target === this.roomModal) {
                this.closeRoomModal();
            }
        });

        // Monitor mudanças no auth
        this.auth.onAuthStateChanged((user) => {
            console.log('Auth state changed:', user?.uid);
            if (user) {
                this.currentUser = user;
                console.log('Current user definido:', this.currentUser.uid);
                this.updateUserPresence();
                this.loadOnlineUsers();
                // Recarregar salas ativas quando o usuário for definido
                this.loadActiveRooms();
            } else {
                this.currentUser = null;
                console.log('Usuário não logado');
            }
        });
    }

    async startPresenceSystem() {
        if (!this.currentUser) return;

        // Atualizar presença a cada 30 segundos
        setInterval(() => this.updateUserPresence(), 30000);
        
        // Remover presença quando a página for fechada
        window.addEventListener('beforeunload', () => this.removeUserPresence());
    }

    async updateUserPresence() {
        if (!this.currentUser) return;

        try {
            // Buscar tag do usuário
            const usersRef = collection(db, "users");
            const userQuery = query(usersRef, where("uid", "==", this.currentUser.uid));
            const querySnapshot = await getDocs(userQuery);
            
            let userTag = 'membro'; // Tag padrão
            let userData = null;
            
            if (!querySnapshot.empty) {
                userData = querySnapshot.docs[0].data();
                userTag = userData.tag || 'membro'; // Garantir que sempre tenha tag
                
                // Se o usuário não tem tag no banco, atualizar para adicionar
                if (!userData.tag) {
                    const userDocRef = doc(db, "users", this.currentUser.uid);
                    await updateDoc(userDocRef, { tag: 'membro' });
                }
            } else {
                // Se não existe documento do usuário, criar um básico
                const userDocRef = doc(db, "users", this.currentUser.uid);
                await setDoc(userDocRef, {
                    uid: this.currentUser.uid,
                    email: this.currentUser.email,
                    fullName: this.getUserName(),
                    tag: 'membro',
                    createdAt: new Date()
                });
            }

            const presenceRef = doc(db, 'userPresence', this.currentUser.uid);
            await setDoc(presenceRef, {
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                userName: this.getUserName(),
                userTag: userTag,
                lastSeen: new Date(),
                isOnline: true
            }, { merge: true });
        } catch (error) {
            console.error('Erro ao atualizar presença:', error);
        }
    }

    async removeUserPresence() {
        if (!this.currentUser) return;

        try {
            const presenceRef = doc(db, 'userPresence', this.currentUser.uid);
            await updateDoc(presenceRef, {
                isOnline: false,
                lastSeen: new Date()
            });
        } catch (error) {
            console.error('Erro ao remover presença:', error);
        }
    }

    loadOnlineUsers() {
        const presenceQuery = query(
            collection(db, 'userPresence'),
            where('isOnline', '==', true)
        );

        onSnapshot(presenceQuery, (snapshot) => {
            this.onlineUsers.clear();
            
            snapshot.forEach((doc) => {
                const userData = doc.data();
                // Verificar se o usuário estava online nos últimos 2 minutos
                const lastSeen = userData.lastSeen?.toDate();
                const now = new Date();
                const timeDiff = now - lastSeen;
                
                if (timeDiff < 2 * 60 * 1000) { // 2 minutos
                    this.onlineUsers.set(userData.userId, userData);
                }
            });
            
            this.renderOnlineUsers();
        });
    }

    renderOnlineUsers() {
        if (!this.onlineUsersContainer) return;

        if (this.onlineUsers.size === 0) {
            this.onlineUsersContainer.innerHTML = `
                <div class="text-center text-gray-500 text-sm">Nenhum usuário online</div>
            `;
            return;
        }

        let html = '';
        this.onlineUsers.forEach((userData, userId) => {
            if (userId === this.currentUser?.uid) return; // Não mostrar o próprio usuário
            
            const isSelected = this.selectedUsers.has(userId);
            const userTag = userData.userTag || 'membro';
            
            // Usar função estática para renderizar tag
            const tagHtml = typeof window !== 'undefined' && window.profileManager ? 
                this.renderUserTagStatic(userTag, 'small') : 
                '';
            
            html += `
                <div class="user-item flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }" data-user-id="${userId}">
                    <div class="flex items-center space-x-3">
                        <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                            <div class="flex items-center space-x-2">
                                ${tagHtml}
                                <span class="font-medium text-gray-800">${this.escapeHtml(userData.userName)}</span>
                            </div>
                            <div class="text-xs text-gray-500">${this.escapeHtml(userData.userEmail)}</div>
                        </div>
                    </div>
                    <div class="text-sm ${isSelected ? 'text-blue-600' : 'text-gray-400'}">
                        ${isSelected ? '✓' : '+'}
                    </div>
                </div>
            `;
        });

        this.onlineUsersContainer.innerHTML = html;

        // Adicionar event listeners
        this.onlineUsersContainer.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                this.toggleUserSelection(userId);
            });
        });
    }

    toggleUserSelection(userId) {
        if (this.selectedUsers.has(userId)) {
            this.selectedUsers.delete(userId);
        } else {
            this.selectedUsers.add(userId);
        }
        
        this.renderOnlineUsers();
        this.renderSelectedUsers();
        this.updateCreateButton();
    }

    renderSelectedUsers() {
        if (!this.selectedUsersContainer) return;

        if (this.selectedUsers.size === 0) {
            this.selectedUsersContainer.innerHTML = `
                <div class="text-center text-gray-400 text-sm">Nenhum usuário selecionado</div>
            `;
            return;
        }

        let html = '';
        this.selectedUsers.forEach(userId => {
            const userData = this.onlineUsers.get(userId);
            if (userData) {
                html += `
                    <div class="flex items-center justify-between bg-white p-2 rounded-lg border">
                        <span class="text-sm font-medium text-gray-800">${this.escapeHtml(userData.userName)}</span>
                        <button class="text-red-500 hover:text-red-700 text-sm" onclick="window.devotionalGroup.toggleUserSelection('${userId}')">
                            ✕
                        </button>
                    </div>
                `;
            }
        });

        this.selectedUsersContainer.innerHTML = html;
    }

    updateCreateButton() {
        if (!this.createBtn) return;
        
        const hasSelectedUsers = this.selectedUsers.size > 0;
        this.createBtn.disabled = !hasSelectedUsers;
        
        if (hasSelectedUsers) {
            this.createBtn.textContent = `🙏 Criar Sala (${this.selectedUsers.size} participantes)`;
        } else {
            this.createBtn.textContent = '🙏 Criar Sala de Devocional';
        }
    }

    clearSelection() {
        this.selectedUsers.clear();
        this.renderOnlineUsers();
        this.renderSelectedUsers();
        this.updateCreateButton();
    }

    async createDevotionalRoom(e) {
        e.preventDefault();
        
        if (this.selectedUsers.size === 0) {
            alert('Selecione pelo menos um participante!');
            return;
        }

        const title = document.getElementById('devotionalTitle').value;
        const book = document.getElementById('devotionalBook').value;
        const chapter = document.getElementById('devotionalChapter').value;
        const verse = document.getElementById('devotionalVerse').value;
        const description = document.getElementById('devotionalDescription').value;

        // Desabilitar botão durante criação
        this.createBtn.disabled = true;
        this.createBtn.textContent = 'Criando sala...';

        try {
            // Incluir o criador na lista de participantes
            const allParticipants = [this.currentUser.uid, ...Array.from(this.selectedUsers)];
            const allParticipantNames = [
                this.getUserName(),
                ...Array.from(this.selectedUsers).map(userId => {
                    const userData = this.onlineUsers.get(userId);
                    return userData ? userData.userName : 'Usuário';
                })
            ];

            console.log('Criando sala com participantes:', allParticipants);
            console.log('Nomes dos participantes:', allParticipantNames);

            // Criar sala de devocional
            const roomData = {
                title,
                book,
                chapter: parseInt(chapter),
                verse,
                description,
                createdBy: this.currentUser.uid,
                createdByName: this.getUserName(),
                participants: allParticipants,
                participantNames: allParticipantNames,
                createdAt: new Date(),
                isActive: true
            };

            console.log('Dados da sala a ser criada:', roomData);

            const roomRef = await addDoc(collection(db, 'devotionalRooms'), roomData);
            console.log('Sala criada com ID:', roomRef.id);
            
            // Limpar formulário
            this.devotionalForm.reset();
            this.clearSelection();
            
            // Abrir sala criada automaticamente
            this.openDevotionalRoom(roomRef.id, { id: roomRef.id, ...roomData });
            
            // Mostrar notificação de sucesso de forma elegante
            this.showSuccessNotification(`Sala "${title}" criada com sucesso! Todos os participantes podem vê-la em "Salas de Devocional Ativas".`);
            
        } catch (error) {
            console.error('Erro ao criar sala:', error);
            alert('Erro ao criar sala de devocional. Tente novamente.');
        } finally {
            // Reabilitar botão
            this.createBtn.disabled = false;
            this.createBtn.textContent = '🙏 Criar Sala de Devocional';
        }
    }

    loadActiveRooms() {
        console.log('Carregando salas ativas...');
        
        // Remover orderBy temporariamente para evitar problemas de índice
        const roomsQuery = query(
            collection(db, 'devotionalRooms'),
            where('isActive', '==', true)
        );

        onSnapshot(roomsQuery, (snapshot) => {
            console.log('Snapshot recebido, tamanho:', snapshot.size);
            this.activeRooms.clear();
            
            snapshot.forEach((doc) => {
                const roomData = { id: doc.id, ...doc.data() };
                console.log('Sala encontrada:', roomData);
                this.activeRooms.set(doc.id, roomData);
            });
            
            console.log('Total de salas ativas:', this.activeRooms.size);
            console.log('Current user:', this.currentUser?.uid);
            this.renderActiveRooms();
        });
    }

    renderActiveRooms() {
        console.log('Renderizando salas ativas...');
        if (!this.activeRoomsContainer) {
            console.log('Container de salas ativas não encontrado');
            return;
        }

        if (this.activeRooms.size === 0) {
            console.log('Nenhuma sala ativa encontrada');
            this.activeRoomsContainer.innerHTML = `
                <div class="text-center text-gray-500 p-8">
                    Nenhuma sala ativa no momento
                </div>
            `;
            return;
        }

        // Filtrar salas onde o usuário é participante
        const userRooms = [];
        this.activeRooms.forEach((room, roomId) => {
            console.log('Verificando sala:', roomId, 'Participantes:', room.participants, 'Current user:', this.currentUser?.uid);
            if (room.participants && room.participants.includes(this.currentUser?.uid)) {
                console.log('Usuário é participante da sala:', roomId);
                userRooms.push({ id: roomId, ...room });
            }
        });

        console.log('Salas do usuário:', userRooms.length);

        if (userRooms.length === 0) {
            this.activeRoomsContainer.innerHTML = `
                <div class="text-center text-gray-500 p-8">
                    <div class="mb-4">🕊️</div>
                    <p>Você não está participando de nenhuma sala no momento</p>
                    <p class="text-sm mt-2">Crie uma nova sala ou aguarde ser convidado para uma</p>
                </div>
            `;
            return;
        }

        let html = '';
        userRooms.forEach((room) => {
            const isCreator = room.createdBy === this.currentUser?.uid;
            
            html += `
                <div class="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 border-l-4 ${
                    isCreator ? 'border-blue-500' : 'border-green-500'
                }">
                    <div class="flex items-start justify-between mb-4">
                        <h4 class="text-lg font-bold text-gray-800">${this.escapeHtml(room.title)}</h4>
                        <div class="flex flex-col items-end space-y-1">
                            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Ativa</span>
                            ${isCreator ? '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Criador</span>' : '<span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Participante</span>'}
                        </div>
                    </div>
                    
                    <div class="space-y-2 mb-4">
                        <p class="text-sm text-gray-600">
                            <strong>📖 Passagem:</strong> ${this.escapeHtml(room.book)} ${room.chapter}:${this.escapeHtml(room.verse)}
                        </p>
                        <p class="text-sm text-gray-600">
                            <strong>👤 Criado por:</strong> ${this.escapeHtml(room.createdByName)}
                        </p>
                        <p class="text-sm text-gray-600">
                            <strong>👥 Participantes:</strong> ${room.participantNames.length} pessoas
                        </p>
                        ${room.description ? `<p class="text-sm text-gray-600 italic">"${this.escapeHtml(room.description)}"</p>` : ''}
                    </div>
                    
                    <button 
                        class="w-full py-3 px-4 rounded-lg text-sm font-medium transition duration-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                        onclick="window.devotionalGroup.openDevotionalRoom('${room.id}', ${JSON.stringify(room).replace(/"/g, '&quot;')})"
                    >
                        🚪 Entrar na Sala
                    </button>
                </div>
            `;
        });

        this.activeRoomsContainer.innerHTML = html;
        console.log('Salas renderizadas:', userRooms.length);
    }

    openDevotionalRoom(roomId, roomData) {
        this.currentRoomId = roomId;
        this.currentRoomData = roomData; // Armazenar dados da sala atual
        
        // Preencher informações da sala
        this.roomTitle.textContent = roomData.title;
        this.roomPassage.textContent = `📖 ${roomData.book} ${roomData.chapter}:${roomData.verse}`;
        this.roomCreator.textContent = `👤 Criado por: ${roomData.createdByName}`;
        this.roomBookChapter.textContent = `${roomData.book} ${roomData.chapter}:${roomData.verse}`;
        this.roomDescription.textContent = roomData.description || 'Sem descrição adicional';
        
        // Verificar se o usuário é o criador da sala para mostrar/esconder botão de excluir
        const isCreator = roomData.createdBy === this.currentUser?.uid;
        this.updateRoomActions(isCreator);
        
        // Renderizar participantes
        this.renderRoomParticipants(roomData.participants, roomData.participantNames);
        
        // Abrir modal
        this.roomModal.classList.remove('hidden');
        
        // Carregar mensagens da sala
        this.loadRoomMessages(roomId);
        
        // Focar no input de mensagem
        setTimeout(() => this.roomChatInput?.focus(), 300);
    }

    updateRoomActions(isCreator) {
        // Mostrar/esconder botão de excluir baseado se é criador
        if (this.deleteRoomBtn) {
            if (isCreator) {
                this.deleteRoomBtn.style.display = 'block';
            } else {
                this.deleteRoomBtn.style.display = 'none';
            }
        }
    }

    renderRoomParticipants(participantIds, participantNames) {
        if (!this.roomParticipants) return;

        let html = '';
        participantNames.forEach((name, index) => {
            const isCurrentUser = participantIds[index] === this.currentUser?.uid;
            
            // Buscar tag do participante nos dados de presença
            let userTag = 'membro'; // Tag padrão
            const userData = this.onlineUsers.get(participantIds[index]);
            if (userData && userData.userTag) {
                userTag = userData.userTag;
            }
            
            const tagHtml = this.renderUserTagStatic(userTag, 'small');
            
            html += `
                <div class="flex items-center space-x-3 p-2 rounded-lg ${isCurrentUser ? 'bg-blue-50' : 'bg-gray-50'}">
                    <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div class="flex items-center space-x-2">
                        ${tagHtml}
                        <span class="text-sm font-medium text-gray-800">
                            ${this.escapeHtml(name)}${isCurrentUser ? ' (Você)' : ''}
                        </span>
                    </div>
                </div>
            `;
        });

        this.roomParticipants.innerHTML = html;
    }

    loadRoomMessages(roomId) {
        // Remover listener anterior se existir
        if (this.roomMessageListener) {
            this.roomMessageListener();
        }

        const messagesQuery = query(
            collection(db, 'devotionalRooms', roomId, 'messages'),
            orderBy('timestamp', 'asc')
        );

        this.roomMessageListener = onSnapshot(messagesQuery, (snapshot) => {
            this.renderRoomMessages(snapshot);
        });
    }

    renderRoomMessages(snapshot) {
        if (!this.roomMessages) return;

        if (snapshot.empty) {
            this.roomMessages.innerHTML = `
                <div class="text-center text-gray-500 p-8">
                    <div class="mb-4">🙏</div>
                    <p>Bem-vindos à sala de devocional!</p>
                    <p class="text-sm mt-2">Compartilhem suas reflexões e orem juntos.</p>
                </div>
            `;
            return;
        }

        let html = '';
        snapshot.forEach((doc) => {
            const message = doc.data();
            const isCurrentUser = message.userId === this.currentUser?.uid;
            const timestamp = message.timestamp?.toDate();
            const timeString = timestamp ? 
                timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

            // Buscar tag do usuário da mensagem
            let userTag = 'membro';
            const userData = this.onlineUsers.get(message.userId);
            if (userData && userData.userTag) {
                userTag = userData.userTag;
            }
            
            const tagHtml = !isCurrentUser ? this.renderUserTagStatic(userTag, 'small') : '';

            html += `
                <div class="flex ${isCurrentUser ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        isCurrentUser 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white border border-gray-200'
                    }">
                        ${!isCurrentUser ? `
                            <div class="flex items-center space-x-2 mb-1">
                                ${tagHtml}
                                <span class="text-xs font-medium text-gray-600">${this.escapeHtml(message.userName)}</span>
                            </div>
                        ` : ''}
                        <div class="text-sm">${this.escapeHtml(message.text)}</div>
                        ${timeString ? `<div class="text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-400'}">${timeString}</div>` : ''}
                    </div>
                </div>
            `;
        });

        this.roomMessages.innerHTML = html;
        
        // Scroll para a última mensagem
        this.roomMessages.scrollTop = this.roomMessages.scrollHeight;
    }

    async sendRoomMessage(e) {
        e.preventDefault();
        
        const messageText = this.roomChatInput.value.trim();
        if (!messageText || !this.currentRoomId) return;

        try {
            const messageData = {
                text: messageText,
                userId: this.currentUser.uid,
                userName: this.getUserName(),
                timestamp: new Date()
            };

            await addDoc(collection(db, 'devotionalRooms', this.currentRoomId, 'messages'), messageData);
            
            // Limpar input
            this.roomChatInput.value = '';
            
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            alert('Erro ao enviar mensagem. Tente novamente.');
        }
    }

    closeRoomModal() {
        this.roomModal.classList.add('hidden');
        this.currentRoomId = null;
        this.currentRoomData = null;
        
        // Remover listener de mensagens
        if (this.roomMessageListener) {
            this.roomMessageListener();
            this.roomMessageListener = null;
        }
    }

    leaveRoom() {
        if (confirm('Tem certeza que deseja sair da sala?')) {
            this.closeRoomModal();
            // Nota: A sala permanece ativa e você pode retornar a ela através da lista "Salas de Devocional Ativas"
        }
    }

    async deleteRoom() {
        if (!this.currentRoomId || !this.currentRoomData) return;

        // Verificar se o usuário é realmente o criador
        if (this.currentRoomData.createdBy !== this.currentUser?.uid) {
            alert('Apenas o criador da sala pode excluí-la!');
            return;
        }

        if (confirm(`Tem certeza que deseja excluir a sala "${this.currentRoomData.title}"? Esta ação não pode ser desfeita.`)) {
            try {
                // Marcar sala como inativa
                const roomRef = doc(db, 'devotionalRooms', this.currentRoomId);
                await updateDoc(roomRef, {
                    isActive: false,
                    deletedAt: new Date(),
                    deletedBy: this.currentUser.uid
                });

                this.showSuccessNotification(`Sala "${this.currentRoomData.title}" excluída com sucesso!`);
                this.closeRoomModal();
            } catch (error) {
                console.error('Erro ao excluir sala:', error);
                alert('Erro ao excluir sala. Tente novamente.');
            }
        }
    }

    shareRoom() {
        if (this.currentRoomId) {
            const roomData = this.activeRooms.get(this.currentRoomId);
            if (roomData) {
                const shareText = `Venha participar do devocional "${roomData.title}" - ${roomData.book} ${roomData.chapter}:${roomData.verse}`;
                
                if (navigator.share) {
                    navigator.share({
                        title: 'Devocional em Grupo',
                        text: shareText
                    });
                } else {
                    // Fallback: copiar para clipboard
                    navigator.clipboard.writeText(shareText).then(() => {
                        alert('Link copiado para a área de transferência!');
                    });
                }
            }
        }
    }

    getUserName() {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            const text = userNameElement.textContent;
            const match = text.match(/Olá,\s*(.+)/);
            return match ? match[1] : this.auth.currentUser?.email?.split('@')[0] || 'Usuário';
        }
        return this.auth.currentUser?.email?.split('@')[0] || 'Usuário';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccessNotification(message) {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300';
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remover após 5 segundos
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    renderUserTagStatic(tag, size = 'small') {
        const tagConfig = {
            'dono': {
                label: 'Dono',
                color: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
                textColor: 'text-white',
                icon: '👑'
            },
            'obreiro': {
                label: 'Obreiro(a)',
                color: 'bg-gradient-to-r from-blue-500 to-blue-600',
                textColor: 'text-white',
                icon: '⛪'
            },
            'cooperador': {
                label: 'Cooperador(a)',
                color: 'bg-gradient-to-r from-green-500 to-green-600',
                textColor: 'text-white',
                icon: '🤝'
            },
            'membro': {
                label: 'Membro',
                color: 'bg-gradient-to-r from-gray-500 to-gray-600',
                textColor: 'text-white',
                icon: '👤'
            }
        };

        if (!tag || !tagConfig[tag]) {
            return ''; // Sem tag
        }

        const config = tagConfig[tag];
        const sizeClasses = size === 'large' ? 'px-3 py-1 text-sm' : 'px-2 py-1 text-xs';
        
        return `
            <span class="${config.color} ${config.textColor} ${sizeClasses} rounded-full font-bold inline-flex items-center space-x-1 shadow-lg">
                <span>${config.icon}</span>
                <span>${config.label}</span>
            </span>
        `;
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que o auth foi inicializado
    setTimeout(() => {
        window.devotionalGroup = new DevotionalGroupManager();
    }, 1000);
});