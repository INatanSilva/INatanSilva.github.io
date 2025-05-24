import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { addDoc, collection, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validação básica
    if (!fullName || !email || !password || !confirmPassword) {
        alert('Por favor, preencha todos os campos!');
        return;
    }

    if (password !== confirmPassword) {
        alert('As senhas não coincidem!');
        return;
    }

    if (password.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres!');
        return;
    }

    try {
        console.log('Tentando criar usuário...');
        
        // Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('Usuário criado no Auth:', userCredential.user.uid);
        
        // Salvar dados adicionais no Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
            uid: userCredential.user.uid,
            email: email,
            fullName: fullName,
            tag: "membro", // Tag padrão para todos os usuários
            createdAt: new Date()
        });
        
        console.log('Dados salvos no Firestore');
        alert('Usuário registrado com sucesso!');
        window.location.href = "index.html";
        
    } catch (error) {
        console.error('Erro detalhado:', error);
        alert('Erro ao registrar usuário: ' + error.message);
    }
});
