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
} from 'https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js';

class DevotionalGroupManager {
    constructor() {
        this.auth = getAuth();
        this.selectedUsers = new Set();
        this.onlineUsers = new Map();
        this.activeRooms = new Map();
        this.currentUser = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.startPresenceSystem();
        this.loadActiveRooms();
    }

    initializeElements() {
        this.onlineUsersContainer = document.getElementById('onlineUsers');
        this.selectedUsersContainer = document.getElementById('selectedUsers');
        this.devotionalForm = document.getElementById('devotionalForm');
        this.createBtn = document.getElementById('createDevotionalBtn');
        this.clearBtn = document.getElementById('clearSelectionBtn');
        this.activeRoomsContainer = document.getElementById('activeRooms');
    }

    setupEventListeners() {
        // Formulário de criação
        this.devotionalForm?.addEventListener('submit', (e) => this.createDevotionalRoom(e));
        
        // Botão limpar seleção
        this.clearBtn?.addEventListener('click', () => this.clearSelection());

        // Monitor mudanças no auth
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.updateUserPresence();
                this.loadOnlineUsers();
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
            const presenceRef = doc(db, 'userPresence', this.currentUser.uid);
            await setDoc(presenceRef, {
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                userName: this.getUserName(),
                lastSeen: serverTimestamp(),
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
                lastSeen: serverTimestamp()
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
            html += `
                <div class="user-item flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }" data-user-id="${userId}">
                    <div class="flex items-center space-x-3">
                        <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                            <div class="font-medium text-gray-800">${this.escapeHtml(userData.userName)}</div>
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

        const formData = new FormData(this.devotionalForm);
        const title = document.getElementById('devotionalTitle').value;
        const book = document.getElementById('devotionalBook').value;
        const chapter = document.getElementById('devotionalChapter').value;
        const verse = document.getElementById('devotionalVerse').value;
        const description = document.getElementById('devotionalDescription').value;

        try {
            // Criar sala de devocional
            const roomData = {
                title,
                book,
                chapter,
                verse,
                description,
                createdBy: this.currentUser.uid,
                createdByName: this.getUserName(),
                participants: Array.from(this.selectedUsers),
                participantNames: Array.from(this.selectedUsers).map(userId => {
                    const userData = this.onlineUsers.get(userId);
                    return userData ? userData.userName : 'Usuário';
                }),
                createdAt: serverTimestamp(),
                isActive: true,
                messages: []
            };

            const roomRef = await addDoc(collection(db, 'devotionalRooms'), roomData);
            
            // Limpar formulário
            this.devotionalForm.reset();
            this.clearSelection();
            
            alert('Sala de devocional criada com sucesso!');
            
            // Abrir sala criada
            this.openDevotionalRoom(roomRef.id, roomData);
            
        } catch (error) {
            console.error('Erro ao criar sala:', error);
            alert('Erro ao criar sala de devocional. Tente novamente.');
        }
    }

    loadActiveRooms() {
        const roomsQuery = query(
            collection(db, 'devotionalRooms'),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );

        onSnapshot(roomsQuery, (snapshot) => {
            this.activeRooms.clear();
            
            snapshot.forEach((doc) => {
                this.activeRooms.set(doc.id, { id: doc.id, ...doc.data() });
            });
            
            this.renderActiveRooms();
        });
    }

    renderActiveRooms() {
        if (!this.activeRoomsContainer) return;

        if (this.activeRooms.size === 0) {
            this.activeRoomsContainer.innerHTML = `
                <div class="text-center text-gray-500 p-8">
                    Nenhuma sala ativa no momento
                </div>
            `;
            return;
        }

        let html = '';
        this.activeRooms.forEach((room, roomId) => {
            const canJoin = room.participants.includes(this.currentUser?.uid) || room.createdBy === this.currentUser?.uid;
            
            html += `
                <div class="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition duration-300">
                    <div class="flex items-start justify-between mb-4">
                        <h4 class="text-lg font-bold text-gray-800">${this.escapeHtml(room.title)}</h4>
                        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Ativa</span>
                    </div>
                    
                    <div class="space-y-2 mb-4">
                        <p class="text-sm text-gray-600">
                            <strong>Passagem:</strong> ${this.escapeHtml(room.book)} ${room.chapter}:${this.escapeHtml(room.verse)}
                        </p>
                        <p class="text-sm text-gray-600">
                            <strong>Criado por:</strong> ${this.escapeHtml(room.createdByName)}
                        </p>
                        <p class="text-sm text-gray-600">
                            <strong>Participantes:</strong> ${room.participantNames.join(', ')}
                        </p>
                        ${room.description ? `<p class="text-sm text-gray-600">${this.escapeHtml(room.description)}</p>` : ''}
                    </div>
                    
                    <button 
                        class="w-full py-2 px-4 rounded-lg text-sm font-medium transition duration-200 ${
                            canJoin 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        }"
                        ${canJoin ? `onclick="window.devotionalGroup.openDevotionalRoom('${roomId}', ${JSON.stringify(room).replace(/"/g, '&quot;')})"` : 'disabled'}
                    >
                        ${canJoin ? 'Entrar na Sala' : 'Sala Privada'}
                    </button>
                </div>
            `;
        });

        this.activeRoomsContainer.innerHTML = html;
    }

    openDevotionalRoom(roomId, roomData) {
        // Por enquanto, apenas mostrar um alert com os detalhes
        // Futuramente, isso pode abrir um modal ou redirecionar para uma página específica
        alert(`Abrindo sala: ${roomData.title}\nPassagem: ${roomData.book} ${roomData.chapter}:${roomData.verse}`);
        
        // Aqui você pode implementar a lógica para abrir a sala de devocional
        // Por exemplo, abrir um modal com chat específico da sala
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
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que o auth foi inicializado
    setTimeout(() => {
        window.devotionalGroup = new DevotionalGroupManager();
    }, 1000);
}); 