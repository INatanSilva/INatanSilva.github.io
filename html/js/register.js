function handleRegister(event) {
    event.preventDefault();

    const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };

    console.log('Dados do registro:', formData);

    alert(`Registro realizado com sucesso!\nBem-vindo(a), ${formData.fullName}!`);

    window.location.href = 'index.html';

    return false;
}

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password) {
        alert('Login realizado com sucesso!');
        // Aqui você pode redirecionar para a dashboard
        window.location.href = 'dashboard.html';
    } else {
        alert('Por favor, preencha todos os campos.');
    }

    return false;
}
