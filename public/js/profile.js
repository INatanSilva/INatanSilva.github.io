import { db } from './firebase.js';
import { 
    collection, 
    doc, 
    getDoc,
    getDocs,
    query, 
    where,
    updateDoc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

class ProfileManager {
    constructor() {
        this.auth = getAuth();
        this.currentUser = null;
        this.userProfile = null;
        
        // Configuração das tags com cores
        this.tagConfig = {
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
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Botões
        this.profileBtn = document.getElementById('profileBtn');
        this.closeProfileModalBtn = document.getElementById('closeProfileModal');
        this.closeProfileBtn = document.getElementById('closeProfileBtn');
        this.editProfileBtn = document.getElementById('editProfileBtn');
        
        // Modal
        this.profileModal = document.getElementById('profileModal');
        
        // Elementos do perfil
        this.profileAvatar = document.getElementById('profileAvatar');
        this.profileUserTag = document.getElementById('profileUserTag');
        this.profileUserName = document.getElementById('profileUserName');
        this.profileUserEmail = document.getElementById('profileUserEmail');
        this.profileMemberSince = document.getElementById('profileMemberSince');
        this.profileRoomsCreated = document.getElementById('profileRoomsCreated');
        this.profileParticipations = document.getElementById('profileParticipations');
    }

    setupEventListeners() {
        // Abrir modal
        this.profileBtn?.addEventListener('click', () => this.openProfile());
        
        // Fechar modal
        this.closeProfileModalBtn?.addEventListener('click', () => this.closeProfile());
        this.closeProfileBtn?.addEventListener('click', () => this.closeProfile());
        
        // Editar perfil (funcionalidade futura)
        this.editProfileBtn?.addEventListener('click', () => this.editProfile());
        
        // Fechar modal clicando fora
        this.profileModal?.addEventListener('click', (e) => {
            if (e.target === this.profileModal) {
                this.closeProfile();
            }
        });

        // Monitor mudanças no auth
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserProfile();
            }
        });
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        try {
            // Buscar dados do usuário na coleção users
            const usersRef = collection(db, "users");
            const userQuery = query(usersRef, where("uid", "==", this.currentUser.uid));
            const querySnapshot = await getDocs(userQuery);
            
            if (!querySnapshot.empty) {
                this.userProfile = querySnapshot.docs[0].data();
                this.userProfile.docId = querySnapshot.docs[0].id;
                
                // Garantir que sempre tenha tag "membro" por padrão
                if (!this.userProfile.tag) {
                    this.userProfile.tag = 'membro';
                    // Atualizar no banco de dados
                    const userDocRef = doc(db, "users", querySnapshot.docs[0].id);
                    await updateDoc(userDocRef, { tag: 'membro' });
                }
                
                console.log('Perfil do usuário carregado:', this.userProfile);
            } else {
                console.log('Perfil do usuário não encontrado, criando perfil padrão');
                // Criar perfil básico se não existir
                this.userProfile = {
                    uid: this.currentUser.uid,
                    email: this.currentUser.email,
                    fullName: this.currentUser.email.split('@')[0],
                    tag: 'membro', // Tag padrão
                    createdAt: new Date()
                };
                
                // Salvar no banco de dados
                const userDocRef = doc(db, "users", this.currentUser.uid);
                await setDoc(userDocRef, this.userProfile);
            }
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
        }
    }

    async getUserStatistics() {
        if (!this.currentUser) return { roomsCreated: 0, participations: 0 };

        try {
            // Buscar salas criadas pelo usuário
            const roomsQuery = query(
                collection(db, 'devotionalRooms'),
                where('createdBy', '==', this.currentUser.uid)
            );
            const roomsSnapshot = await getDocs(roomsQuery);
            
            // Buscar participações em salas
            const participationsQuery = query(
                collection(db, 'devotionalRooms'),
                where('participants', 'array-contains', this.currentUser.uid)
            );
            const participationsSnapshot = await getDocs(participationsQuery);
            
            return {
                roomsCreated: roomsSnapshot.size,
                participations: participationsSnapshot.size
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return { roomsCreated: 0, participations: 0 };
        }
    }

    renderUserTag(tag, size = 'small') {
        if (!tag || !this.tagConfig[tag]) {
            return ''; // Sem tag
        }

        const config = this.tagConfig[tag];
        const sizeClasses = size === 'large' ? 'px-3 py-1 text-sm' : 'px-2 py-1 text-xs';
        
        return `
            <span class="${config.color} ${config.textColor} ${sizeClasses} rounded-full font-bold inline-flex items-center space-x-1 shadow-lg">
                <span>${config.icon}</span>
                <span>${config.label}</span>
            </span>
        `;
    }

    updateUserDisplayWithTag(userName, tag) {
        const userNameElement = document.getElementById('userName');
        if (userNameElement && tag) {
            const tagHtml = this.renderUserTag(tag);
            userNameElement.innerHTML = `
                <div class="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2">
                    ${tagHtml}
                    <span class="text-sm sm:text-base">Olá, ${userName}</span>
                </div>
            `;
        } else if (userNameElement) {
            userNameElement.innerHTML = `<span class="text-sm sm:text-base">Olá, ${userName}</span>`;
        }
    }

    async openProfile() {
        if (!this.userProfile) {
            await this.loadUserProfile();
        }

        // Carregar estatísticas
        const stats = await this.getUserStatistics();
        
        // Preencher dados do perfil
        if (this.userProfile) {
            // Avatar (primeira letra do nome)
            const firstLetter = (this.userProfile.fullName || this.userProfile.email || 'U')[0].toUpperCase();
            this.profileAvatar.textContent = firstLetter;
            
            // Tag do usuário
            const tag = this.userProfile.tag || 'membro';
            this.profileUserTag.innerHTML = this.renderUserTag(tag, 'large');
            
            // Nome e email
            this.profileUserName.textContent = this.userProfile.fullName || this.userProfile.email.split('@')[0];
            this.profileUserEmail.textContent = this.userProfile.email;
            
            // Data de criação
            const memberSince = this.userProfile.createdAt ? 
                new Date(this.userProfile.createdAt.seconds * 1000 || this.userProfile.createdAt).toLocaleDateString('pt-BR') : 
                'Data indisponível';
            this.profileMemberSince.textContent = memberSince;
            
            // Estatísticas
            this.profileRoomsCreated.textContent = stats.roomsCreated;
            this.profileParticipations.textContent = stats.participations;
        }
        
        // Mostrar modal
        this.profileModal.classList.remove('hidden');
    }

    closeProfile() {
        this.profileModal.classList.add('hidden');
    }

    editProfile() {
        // Funcionalidade futura - por enquanto só um alerta
        alert('Funcionalidade de edição de perfil será implementada em breve!');
    }

    // Função utilitária para renderizar tags em outros componentes
    static renderUserTag(tag, size = 'small') {
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

// Inicializar o gerenciador de perfil
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.profileManager = new ProfileManager();
    }, 1000);
}); 