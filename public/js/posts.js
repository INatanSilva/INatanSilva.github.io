import { db } from './firebase.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    orderBy, 
    query, 
    where,
    doc,
    updateDoc,
    getDocs,
    deleteDoc,
    arrayUnion,
    arrayRemove,
    increment
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

class PostsManager {
    constructor() {
        this.auth = getAuth();
        this.currentUser = null;
        this.userProfiles = new Map();
        this.posts = new Map();
        this.commentListeners = new Map();
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadPosts();
        
        // Monitor mudanças no auth
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserProfile(user.uid);
                console.log('Usuário logado:', user.uid);
            } else {
                console.log('Usuário não está logado');
            }
        });
    }

    initializeElements() {
        // Botões e modais
        this.createPostBtn = document.getElementById('createPostBtn');
        this.createPostModal = document.getElementById('createPostModal');
        this.closeCreatePostModalBtn = document.getElementById('closeCreatePostModal');
        this.cancelCreatePostBtn = document.getElementById('cancelCreatePost');
        this.createPostForm = document.getElementById('createPostForm');
        
        // Container de posts
        this.postsContainer = document.getElementById('postsContainer');
        
        // Campos do formulário
        this.postTitle = document.getElementById('postTitle');
        this.postContent = document.getElementById('postContent');
        this.postVerse = document.getElementById('postVerse');
    }

    setupEventListeners() {
        // Abrir modal de criar post
        this.createPostBtn?.addEventListener('click', () => this.openCreatePostModal());
        
        // Fechar modal
        this.closeCreatePostModalBtn?.addEventListener('click', () => this.closeCreatePostModal());
        this.cancelCreatePostBtn?.addEventListener('click', () => this.closeCreatePostModal());
        
        // Enviar post
        this.createPostForm?.addEventListener('submit', (e) => this.createPost(e));
        
        // Fechar modal clicando fora
        this.createPostModal?.addEventListener('click', (e) => {
            if (e.target === this.createPostModal) {
                this.closeCreatePostModal();
            }
        });

        // Event listeners para comentários
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.postId;
                const commentsSection = document.getElementById(`comments-${postId}`);
                const input = commentsSection.querySelector('input[type="text"]');
                if (input) {
                    input.focus();
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });

        // Event listeners para botões de ver mais/menos comentários
        document.querySelectorAll('[id^="comments-toggle-"]').forEach(toggleDiv => {
            const button = toggleDiv.querySelector('button');
            if (button) {
                button.addEventListener('click', (e) => {
                    const postId = toggleDiv.id.replace('comments-toggle-', '');
                    this.toggleAllComments(postId);
                });
            }
        });

        // Event listeners para formulários de comentário
        document.querySelectorAll('.comment-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const postId = e.currentTarget.dataset.postId;
                const input = e.currentTarget.querySelector('input[type="text"]');
                const content = input.value.trim();
                if (content) {
                    console.log('Enviando comentário:', { postId, content });
                    this.addComment(postId, content);
                    input.value = '';
                }
            });
            
            // Adicionar evento para envio com Enter
            const input = form.querySelector('input[type="text"]');
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        form.dispatchEvent(new Event('submit'));
                    }
                });
            }
        });
    }

    openCreatePostModal() {
        if (!this.currentUser) {
            alert('Você precisa estar logado para criar uma postagem!');
            return;
        }
        this.createPostModal.classList.remove('hidden');
        this.postTitle.focus();
    }

    closeCreatePostModal() {
        this.createPostModal.classList.add('hidden');
        this.createPostForm.reset();
    }

    async createPost(e) {
        e.preventDefault();
        
        if (!this.currentUser) {
            alert('Você precisa estar logado!');
            return;
        }

        const title = this.postTitle.value.trim();
        const content = this.postContent.value.trim();
        const verse = this.postVerse.value.trim();

        if (!title || !content) {
            alert('Por favor, preencha título e conteúdo!');
            return;
        }

        try {
            // Buscar perfil do usuário
            const userProfile = await this.loadUserProfile(this.currentUser.uid);
            
            const postData = {
                title,
                content,
                verse: verse || null,
                authorId: this.currentUser.uid,
                authorName: userProfile.fullName || this.currentUser.email.split('@')[0],
                authorTag: userProfile.tag || 'membro',
                createdAt: new Date(),
                reactions: {
                    prayers: 0,
                    loves: 0
                },
                reactedUsers: {
                    prayers: [],
                    loves: []
                },
                commentsCount: 0
            };

            await addDoc(collection(db, 'posts'), postData);
            
            this.closeCreatePostModal();
            this.showSuccessNotification('Reflexão compartilhada com sucesso! 🙏');
            
        } catch (error) {
            console.error('Erro ao criar post:', error);
            alert('Erro ao compartilhar reflexão. Tente novamente.');
        }
    }

    loadPosts() {
        const postsQuery = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc')
        );

        onSnapshot(postsQuery, (snapshot) => {
            this.posts.clear();
            
            snapshot.forEach((doc) => {
                const postData = { id: doc.id, ...doc.data() };
                this.posts.set(doc.id, postData);
            });
            
            this.renderPosts();
        });
    }

    async renderPosts() {
        if (this.posts.size === 0) {
            this.postsContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <div class="mb-4 text-4xl">📝</div>
                    <p>Seja o primeiro a compartilhar uma reflexão!</p>
                    <p class="text-sm mt-2">Clique em "Nova Postagem" para começar</p>
                </div>
            `;
            return;
        }

        let html = '';
        for (const [postId, post] of this.posts) {
            html += await this.renderPost(post);
        }

        this.postsContainer.innerHTML = html;
        
        // Adicionar event listeners após renderizar
        this.setupPostEventListeners();
        
        // Carregar comentários imediatamente após renderizar
        console.log('Carregando comentários automaticamente para', this.posts.size, 'posts');
        this.loadAllComments();
    }

    async renderPost(post) {
        // Carregar perfil do autor se necessário
        if (!this.userProfiles.has(post.authorId)) {
            await this.loadUserProfile(post.authorId);
        }
        
        const userProfile = this.userProfiles.get(post.authorId) || { tag: post.authorTag || 'membro' };
        const tagHtml = this.renderUserTag(userProfile.tag || post.authorTag || 'membro');
        
        const timeAgo = this.getTimeAgo(post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt));
        
        // Verificar se usuário já reagiu
        const hasReactedPrayer = post.reactedUsers?.prayers?.includes(this.currentUser?.uid) || false;
        const hasReactedLove = post.reactedUsers?.loves?.includes(this.currentUser?.uid) || false;
        
        return `
            <article class="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition duration-300 p-4 sm:p-6">
                <!-- Header do Post -->
                <div class="flex items-start space-x-3 mb-4">
                    <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                        ${(post.authorName || 'U')[0].toUpperCase()}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-1">
                            <div class="flex items-center space-x-2">
                                ${tagHtml}
                                <h3 class="font-semibold text-gray-800 text-sm sm:text-base truncate">${this.escapeHtml(post.authorName)}</h3>
                            </div>
                        </div>
                        <p class="text-xs sm:text-sm text-gray-500">${timeAgo}</p>
                    </div>
                </div>

                <!-- Conteúdo do Post -->
                <div class="mb-4">
                    <h2 class="text-lg sm:text-xl font-bold text-gray-800 mb-3 leading-tight">${this.escapeHtml(post.title)}</h2>
                    <div class="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">${this.escapeHtml(post.content)}</div>
                    ${post.verse ? `
                        <div class="mt-4 p-3 sm:p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                            <p class="text-blue-800 font-medium italic text-sm sm:text-base">📖 ${this.escapeHtml(post.verse)}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- Reações e Comentários -->
                <div class="border-t border-gray-100 pt-3 sm:pt-4">
                    <!-- Contador de Reações -->
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
                            ${(post.reactions?.prayers || 0) > 0 ? `
                                <span class="flex items-center space-x-1">
                                    <span class="text-sm">🙏</span>
                                    <span>${post.reactions.prayers}</span>
                                </span>
                            ` : ''}
                            ${(post.reactions?.loves || 0) > 0 ? `
                                <span class="flex items-center space-x-1">
                                    <span class="text-sm">❤️</span>
                                    <span>${post.reactions.loves}</span>
                                </span>
                            ` : ''}
                        </div>
                        <div class="text-xs sm:text-sm text-gray-600">
                            ${(post.commentsCount || 0) > 0 ? `${post.commentsCount} comentário${post.commentsCount > 1 ? 's' : ''}` : ''}
                        </div>
                    </div>

                    <!-- Botões de Ação -->
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                        <div class="flex items-center space-x-1 sm:space-x-2">
                            <button 
                                class="reaction-btn flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg transition duration-200 flex-1 sm:flex-none justify-center sm:justify-start ${hasReactedPrayer ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}"
                                data-post-id="${post.id}" 
                                data-reaction="prayers"
                            >
                                <span class="text-base sm:text-lg">🙏</span>
                                <span class="text-xs sm:text-sm font-medium">Oração</span>
                            </button>
                            
                            <button 
                                class="reaction-btn flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg transition duration-200 flex-1 sm:flex-none justify-center sm:justify-start ${hasReactedLove ? 'bg-red-100 text-red-700' : 'hover:bg-gray-100'}"
                                data-post-id="${post.id}" 
                                data-reaction="loves"
                            >
                                <span class="text-base sm:text-lg">❤️</span>
                                <span class="text-xs sm:text-sm font-medium">Amei</span>
                            </button>
                        </div>
                    </div>

                    <!-- Seção de Comentários -->
                    <div id="comments-${post.id}" class="mt-4 pt-4 border-t border-gray-100">
                        <!-- Primeiros 3 comentários visíveis -->
                        <div id="comments-preview-${post.id}" class="space-y-3 mb-4"></div>
                        
                        <!-- Comentários adicionais (ocultos inicialmente) -->
                        <div id="comments-full-${post.id}" class="hidden space-y-3 mb-4 max-h-64 sm:max-h-80 overflow-y-auto"></div>
                        
                        <!-- Botão Ver Mais/Menos Comentários -->
                        <div id="comments-toggle-${post.id}" class="hidden mb-4">
                            <button class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                <span class="show-more">Ver mais comentários</span>
                                <span class="show-less hidden">Ver menos comentários</span>
                            </button>
                        </div>
                        
                        <!-- Formulário de Novo Comentário -->
                        <form class="comment-form flex space-x-2 sm:space-x-3" data-post-id="${post.id}">
                            <div class="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                ${this.currentUser ? (this.getCurrentUserName()[0].toUpperCase()) : 'U'}
                            </div>
                            <div class="flex-1 flex space-x-2">
                                <input 
                                    type="text" 
                                    placeholder="Escreva um comentário..."
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    required
                                >
                                <button 
                                    type="submit" 
                                    class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition duration-200 flex items-center justify-center flex-shrink-0"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </article>
        `;
    }

    setupPostEventListeners() {
        // Event listeners para reações
        document.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.postId;
                const reaction = e.currentTarget.dataset.reaction;
                this.toggleReaction(postId, reaction);
            });
        });

        // Event listeners para botões de ver mais/menos comentários
        document.querySelectorAll('[id^="comments-toggle-"]').forEach(toggleDiv => {
            const button = toggleDiv.querySelector('button');
            if (button) {
                button.addEventListener('click', (e) => {
                    const postId = toggleDiv.id.replace('comments-toggle-', '');
                    this.toggleAllComments(postId);
                });
            }
        });

        // Event listeners para formulários de comentário
        document.querySelectorAll('.comment-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const postId = e.currentTarget.dataset.postId;
                const input = e.currentTarget.querySelector('input[type="text"]');
                const content = input.value.trim();
                if (content) {
                    console.log('Enviando comentário:', { postId, content });
                    this.addComment(postId, content);
                    input.value = '';
                }
            });
            
            // Adicionar evento para envio com Enter
            const input = form.querySelector('input[type="text"]');
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        form.dispatchEvent(new Event('submit'));
                    }
                });
            }
        });
    }

    async toggleReaction(postId, reactionType) {
        if (!this.currentUser) {
            alert('Você precisa estar logado para reagir!');
            return;
        }

        try {
            const postRef = doc(db, 'posts', postId);
            const post = this.posts.get(postId);
            
            const hasReacted = post.reactedUsers?.[reactionType]?.includes(this.currentUser.uid) || false;
            
            if (hasReacted) {
                // Remover reação
                await updateDoc(postRef, {
                    [`reactions.${reactionType}`]: increment(-1),
                    [`reactedUsers.${reactionType}`]: arrayRemove(this.currentUser.uid)
                });
            } else {
                // Adicionar reação
                await updateDoc(postRef, {
                    [`reactions.${reactionType}`]: increment(1),
                    [`reactedUsers.${reactionType}`]: arrayUnion(this.currentUser.uid)
                });
            }
        } catch (error) {
            console.error('Erro ao reagir ao post:', error);
        }
    }

    async addComment(postId, content) {
        if (!this.currentUser || !content) {
            console.log('Usuário não logado ou conteúdo vazio');
            return;
        }

        console.log('Adicionando comentário:', { postId, content });

        try {
            const userProfile = await this.loadUserProfile(this.currentUser.uid);
            
            const commentData = {
                postId,
                content,
                authorId: this.currentUser.uid,
                authorName: userProfile.fullName || this.currentUser.email.split('@')[0],
                authorTag: userProfile.tag || 'membro',
                createdAt: new Date()
            };

            console.log('Dados do comentário:', commentData);

            await addDoc(collection(db, 'comments'), commentData);
            
            // Incrementar contador de comentários no post
            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, {
                commentsCount: increment(1)
            });

            console.log('Comentário adicionado com sucesso!');
            this.showSuccessNotification('Comentário adicionado! 💬');
            
            // Recarregar comentários para este post específico para garantir exibição imediata
            setTimeout(() => {
                this.loadComments(postId);
            }, 200);
            
        } catch (error) {
            console.error('Erro ao adicionar comentário:', error);
            alert('Erro ao adicionar comentário. Tente novamente.');
        }
    }

    async loadComments(postId) {
        console.log(`Carregando comentários para post: ${postId}`);
        
        try {
            const commentsQuery = query(
                collection(db, 'comments'),
                where('postId', '==', postId),
                orderBy('createdAt', 'asc')
            );

            const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
                console.log(`Snapshot recebido para post ${postId}:`, snapshot.size, 'documentos');
                
                const comments = [];
                snapshot.forEach((doc) => {
                    const comment = { id: doc.id, ...doc.data() };
                    console.log('Comentário encontrado:', comment);
                    comments.push(comment);
                });

                console.log(`Total de comentários para ${postId}:`, comments.length);
                this.renderCommentsWithPreview(postId, comments);
            }, (error) => {
                console.error(`Erro ao carregar comentários para ${postId}:`, error);
            });

            // Armazenar o unsubscribe para limpeza posterior se necessário
            if (!this.commentListeners) {
                this.commentListeners = new Map();
            }
            this.commentListeners.set(postId, unsubscribe);

        } catch (error) {
            console.error(`Erro ao configurar listener de comentários para ${postId}:`, error);
            
            // Em caso de erro, tentar carregar comentários uma vez sem listener
            try {
                const commentsQuery = query(
                    collection(db, 'comments'),
                    where('postId', '==', postId),
                    orderBy('createdAt', 'asc')
                );
                
                const snapshot = await getDocs(commentsQuery);
                const comments = [];
                snapshot.forEach((doc) => {
                    const comment = { id: doc.id, ...doc.data() };
                    comments.push(comment);
                });
                
                console.log(`Comentários carregados diretamente para ${postId}:`, comments.length);
                this.renderCommentsWithPreview(postId, comments);
            } catch (fallbackError) {
                console.error(`Erro no fallback de comentários para ${postId}:`, fallbackError);
            }
        }
    }

    renderCommentsWithPreview(postId, comments) {
        const previewContainer = document.getElementById(`comments-preview-${postId}`);
        const fullContainer = document.getElementById(`comments-full-${postId}`);
        const toggleContainer = document.getElementById(`comments-toggle-${postId}`);
        
        if (!previewContainer || !fullContainer || !toggleContainer) {
            console.log('Containers não encontrados para post:', postId);
            return;
        }

        // Limpar containers
        previewContainer.innerHTML = '';
        fullContainer.innerHTML = '';

        console.log(`Post ${postId}: ${comments.length} comentários encontrados`);

        if (comments.length === 0) {
            // Mostrar mensagem quando não há comentários
            previewContainer.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <div class="mb-2 text-2xl">💬</div>
                    <p class="text-sm">Seja o primeiro a comentar!</p>
                </div>
            `;
            toggleContainer.classList.add('hidden');
            return;
        }

        // Renderizar até 3 comentários no preview
        const previewComments = comments.slice(0, 3);
        const remainingComments = comments.slice(3);

        // Adicionar comentários do preview
        previewComments.forEach(comment => {
            previewContainer.innerHTML += this.renderComment(comment);
        });

        // Se há mais de 3 comentários, mostrar botão e preparar lista completa
        if (remainingComments.length > 0) {
            toggleContainer.classList.remove('hidden');
            
            // Renderizar todos os comentários no container completo
            comments.forEach(comment => {
                fullContainer.innerHTML += this.renderComment(comment);
            });

            // Atualizar texto do botão
            const showMoreSpan = toggleContainer.querySelector('.show-more');
            if (showMoreSpan) {
                showMoreSpan.textContent = `Ver mais ${remainingComments.length} comentários`;
            }
        } else {
            toggleContainer.classList.add('hidden');
        }
    }

    renderComment(comment) {
        const tagHtml = this.renderUserTag(comment.authorTag || 'membro', 'small');
        const timeAgo = this.getTimeAgo(comment.createdAt.toDate ? comment.createdAt.toDate() : new Date(comment.createdAt));
        
        return `
            <div class="flex space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                <div class="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                    ${(comment.authorName || 'U')[0].toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 mb-1">
                        <div class="flex items-center space-x-2">
                            ${tagHtml}
                            <span class="font-medium text-gray-800 text-xs sm:text-sm truncate">${this.escapeHtml(comment.authorName)}</span>
                        </div>
                        <span class="text-xs text-gray-500">${timeAgo}</span>
                    </div>
                    <p class="text-xs sm:text-sm text-gray-700 leading-relaxed break-words">${this.escapeHtml(comment.content)}</p>
                </div>
            </div>
        `;
    }

    // Funções utilitárias
    async loadUserProfile(userId) {
        if (this.userProfiles.has(userId)) return this.userProfiles.get(userId);

        try {
            const usersRef = collection(db, "users");
            const userQuery = query(usersRef, where("uid", "==", userId));
            const querySnapshot = await getDocs(userQuery);
            
            let userProfile = {
                uid: userId,
                tag: 'membro',
                fullName: 'Usuário'
            };
            
            if (!querySnapshot.empty) {
                userProfile = { ...userProfile, ...querySnapshot.docs[0].data() };
            }
            
            this.userProfiles.set(userId, userProfile);
            return userProfile;
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
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
            return '';
        }

        const config = tagConfig[tag];
        
        let sizeClasses;
        let iconSize;
        let textSize;
        
        switch(size) {
            case 'large':
                sizeClasses = 'px-2 py-1';
                iconSize = 'text-sm';
                textSize = 'text-sm';
                break;
            case 'small':
                sizeClasses = 'px-1.5 py-0.5';
                iconSize = 'text-xs';
                textSize = 'text-xs';
                break;
            default:
                sizeClasses = 'px-1.5 py-0.5';
                iconSize = 'text-xs';
                textSize = 'text-xs';
        }
        
        return `
            <span class="${config.color} ${config.textColor} ${sizeClasses} rounded-full font-bold inline-flex items-center space-x-1 shadow-sm w-auto flex-shrink-0">
                <span class="${iconSize}">${config.icon}</span>
                <span class="${textSize}">${config.label}</span>
            </span>
        `;
    }

    getCurrentUserName() {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            const text = userNameElement.textContent;
            const match = text.match(/Olá,\s*(.+)/);
            return match ? match[1] : this.auth.currentUser?.email?.split('@')[0] || 'Usuário';
        }
        return this.auth.currentUser?.email?.split('@')[0] || 'Usuário';
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'agora';
        if (minutes < 60) return `${minutes}min`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        
        return date.toLocaleDateString('pt-BR');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccessNotification(message) {
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
        
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    toggleAllComments(postId) {
        const previewContainer = document.getElementById(`comments-preview-${postId}`);
        const fullContainer = document.getElementById(`comments-full-${postId}`);
        const toggleContainer = document.getElementById(`comments-toggle-${postId}`);
        const showMoreSpan = toggleContainer.querySelector('.show-more');
        const showLessSpan = toggleContainer.querySelector('.show-less');

        if (fullContainer.classList.contains('hidden')) {
            // Mostrar todos os comentários
            previewContainer.classList.add('hidden');
            fullContainer.classList.remove('hidden');
            showMoreSpan.classList.add('hidden');
            showLessSpan.classList.remove('hidden');
        } else {
            // Mostrar apenas o preview
            previewContainer.classList.remove('hidden');
            fullContainer.classList.add('hidden');
            showMoreSpan.classList.remove('hidden');
            showLessSpan.classList.add('hidden');
        }
    }

    // Método para carregar comentários de todos os posts
    loadAllComments() {
        for (const [postId] of this.posts) {
            // Carregar comentários com pequeno delay escalonado para evitar sobrecarga
            setTimeout(() => {
                this.loadComments(postId);
            }, 100);
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, aguardando autenticação...');
    
    // Aguardar Firebase estar pronto
    setTimeout(() => {
        console.log('Inicializando PostsManager...');
        window.postsManager = new PostsManager();
        
        // Carregar comentários automaticamente após inicialização
        setTimeout(() => {
            if (window.postsManager && window.postsManager.posts.size > 0) {
                console.log('Carregando comentários automaticamente após inicialização...');
                window.postsManager.loadAllComments();
            }
        }, 1000);
        
    }, 1500);
}); 