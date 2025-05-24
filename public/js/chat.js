import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

class DevotionalChat {
    constructor() {
        this.auth = getAuth();
        this.isOpen = false;
        this.unreadCount = 0;
        this.lastMessageTime = new Date();
        this.initializeElements();
        this.setupEventListeners();
        this.loadMessages();
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
            await addDoc(collection(db, 'chatMessages'), {
                text: message,
                userId: user.uid,
                userEmail: user.email,
                userName: this.getUserName(),
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

        onSnapshot(messagesQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const messageData = change.doc.data();
                    this.displayMessage(messageData);
                    
                    // Incrementar contador se o chat estiver fechado e não for mensagem própria
                    if (!this.isOpen && messageData.userId !== this.auth.currentUser?.uid) {
                        this.unreadCount++;
                        this.updateUnreadCount();
                    }
                }
            });
        });
    }

    displayMessage(messageData) {
        const messageElement = document.createElement('div');
        const isOwnMessage = messageData.userId === this.auth.currentUser?.uid;
        
        const timeString = messageData.timestamp ? 
            new Date(messageData.timestamp.seconds * 1000).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 
            new Date().toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

        messageElement.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        messageElement.innerHTML = `
            <div class="max-w-xs ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'} rounded-lg p-3 shadow-sm">
                ${!isOwnMessage ? `<div class="text-xs font-semibold text-gray-600 mb-1">${messageData.userName}</div>` : ''}
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
}

// Inicializar o chat quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.devotionalChat = new DevotionalChat();
}); 