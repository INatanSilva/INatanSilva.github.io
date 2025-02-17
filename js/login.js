function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Aqui você pode adicionar a lógica para enviar os dados para seu backend
    console.log('Dados do login:', { email, password });
    
    // Por enquanto, apenas mostra uma mensagem de sucesso
    alert('Login realizado com sucesso!');
    return false;
}
