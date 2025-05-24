import { db } from './firebase.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    orderBy, 
    query, 
    serverTimestamp,
    where,
    getDocs
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

class DevotionalChat {
    constructor() {
        this.auth = getAuth();
        this.isOpen = false;
        this.unreadCount = 0;
        this.lastMessageTime = new Date();
        this.currentUser = null;
        this.userProfiles = new Map(); // Cache de perfis de usuários
        this.loadedMessages = new Set(); // Controlar mensagens já carregadas
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadMessages();
        
        // Monitor mudanças no auth
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserProfile(user.uid);
            }
        });
    }

    initializeElements() {
        this.chatToggle = document.getElementById('chatToggle');
        this.chatWindow = document.getElementById('chatWindow');
        this.chatClose = document.getElementById('chatClose');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatForm = document.getElementById('chatForm');
        this.chatInput = document.getElementById('chatInput');
        this.unreadCountElement = document.getElementById('unreadCount');
    }

    setupEventListeners() {
        // Abrir/Fechar chat
        this.chatToggle.addEventListener('click', () => this.toggleChat());
        this.chatClose.addEventListener('click', () => this.closeChat());

        // Enviar mensagem
        this.chatForm.addEventListener('submit', (e) => this.sendMessage(e));

        // Fechar chat quando clicar fora
        document.addEventListener('click', (e) => {
            if (!document.getElementById('chatWidget').contains(e.target)) {
                // Comentado para não fechar automaticamente
                // this.closeChat();
            }
        });
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        this.chatWindow.classList.remove('hidden');
        this.chatToggle.classList.add('hidden');
        this.isOpen = true;
        this.unreadCount = 0;
        this.updateUnreadCount();
        this.scrollToBottom();
        this.chatInput.focus();
    }

    closeChat() {
        this.chatWindow.classList.add('hidden');
        this.chatToggle.classList.remove('hidden');
        this.isOpen = false;
    }

    async sendMessage(e) {
        e.preventDefault();
        
        const message = this.chatInput.value.trim();
        if (!message) return;

        const user = this.auth.currentUser;
        if (!user) {
            alert('Você precisa estar logado para enviar mensagens!');
            return;
        }

        try {
            // Carregar perfil do usuário para pegar a tag
            const userProfile = await this.loadUserProfile(user.uid);
            
            await addDoc(collection(db, 'chatMessages'), {
                text: message,
                userId: user.uid,
                userEmail: user.email,
                userName: userProfile.fullName || this.getUserName(),
                userTag: userProfile.tag || 'membro',
                timestamp: serverTimestamp(),
                createdAt: new Date()
            });

            this.chatInput.value = '';
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            alert('Erro ao enviar mensagem. Tente novamente.');
        }
    }

    getUserName() {
        // Pegar o nome do usuário do elemento da página ou usar o email
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            const text = userNameElement.textContent;
            // Extrair nome do texto "Olá, Nome"
            const match = text.match(/Olá,\s*(.+)/);
            return match ? match[1] : this.auth.currentUser?.email?.split('@')[0] || 'Usuário';
        }
        return this.auth.currentUser?.email?.split('@')[0] || 'Usuário';
    }

    loadMessages() {
        const messagesQuery = query(
            collection(db, 'chatMessages'),
            orderBy('timestamp', 'asc')
        );

        onSnapshot(messagesQuery, async (snapshot) => {
            // Processar mensagens
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    const messageData = change.doc.data();
                    const messageId = change.doc.id;
                    
                    // Verificar se a mensagem já foi carregada
                    if (!this.loadedMessages.has(messageId)) {
                        await this.displayMessage(messageData);
                        this.loadedMessages.add(messageId);
                        
                        // Incrementar contador se o chat estiver fechado e não for mensagem própria
                        if (!this.isOpen && messageData.userId !== this.auth.currentUser?.uid) {
                            this.unreadCount++;
                            this.updateUnreadCount();
                        }
                    }
                }
            }
        });
    }

    async displayMessage(messageData) {
        const messageElement = document.createElement('div');
        const isOwnMessage = messageData.userId === this.auth.currentUser?.uid;
        
        // Carregar perfil do usuário se não estiver em cache
        if (!isOwnMessage && !this.userProfiles.has(messageData.userId)) {
            await this.loadUserProfile(messageData.userId);
        }
        
        const userProfile = this.userProfiles.get(messageData.userId) || { tag: messageData.userTag || 'membro' };
        const userTag = userProfile.tag || messageData.userTag || 'membro';
        
        const timeString = messageData.timestamp ? 
            new Date(messageData.timestamp.seconds * 1000).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 
            new Date().toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

        const tagHtml = !isOwnMessage ? this.renderUserTag(userTag, 'small') : '';

        messageElement.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        messageElement.innerHTML = `
            <div class="max-w-xs ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'} rounded-lg p-3 shadow-sm">
                ${!isOwnMessage ? `
                    <div class="flex items-center space-x-2 mb-1">
                        ${tagHtml}
                        <span class="text-xs font-semibold text-gray-600">${this.escapeHtml(messageData.userName)}</span>
                    </div>
                ` : ''}
                <div class="text-sm">${this.escapeHtml(messageData.text)}</div>
                <div class="text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-400'} mt-1">${timeString}</div>
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    updateUnreadCount() {
        if (this.unreadCount > 0) {
            this.unreadCountElement.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            this.unreadCountElement.classList.remove('hidden');
        } else {
            this.unreadCountElement.classList.add('hidden');
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadUserProfile(userId) {
        if (this.userProfiles.has(userId)) return this.userProfiles.get(userId);

        try {
            const usersRef = collection(db, "users");
            const userQuery = query(usersRef, where("uid", "==", userId));
            const querySnapshot = await getDocs(userQuery);
            
            let userProfile = {
                uid: userId,
                tag: 'membro', // Tag padrão
                fullName: 'Usuário'
            };
            
            if (!querySnapshot.empty) {
                userProfile = { ...userProfile, ...querySnapshot.docs[0].data() };
            }
            
            this.userProfiles.set(userId, userProfile);
            return userProfile;
        } catch (error) {
            console.error('Erro ao carregar perfil do usuário:', error);
            return { uid: userId, tag: 'membro', fullName: 'Usuário' };
        }
    }

    renderUserTag(tag, size = 'small') {
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
        const sizeClasses = size === 'large' ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-xs';
        
        return `
            <span class="${config.color} ${config.textColor} ${sizeClasses} rounded-full font-bold inline-flex items-center space-x-1 shadow-sm">
                <span class="text-xs">${config.icon}</span>
                <span class="text-xs">${config.label}</span>
            </span>
        `;
    }
}

// Inicializar o chat quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.devotionalChat = new DevotionalChat();
}); 