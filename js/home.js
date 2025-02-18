const verses = [
    "\"A paz deixo convosco, a minha paz vos dou.\" - João 14:27",
    "\"O Senhor é a minha luz e a minha salvação.\" - Salmos 27:1",
    "\"Grandes coisas fez o Senhor por nós, e por isso estamos alegres.\" - Salmos 126:3"
];

function updateVerse() {
    const verse = verses[Math.floor(Math.random() * verses.length)];
    document.getElementById('verse').textContent = verse;
}

function subscribeNewsletter(event) {
    event.preventDefault();
    const email = event.target.querySelector('input[type="email"]').value;
    alert(`Obrigado por se inscrever. Suas reflexões serão enviadas para ${email}`);
    event.target.reset();
    return false;
}

// Função para navegação
function navegarPara(secaoId) {
    // Remove a classe active de todas as seções e links
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Adiciona a classe active na seção e link correspondentes
    document.getElementById(secaoId).classList.add('active');
    document.querySelector(`[data-section="${secaoId}"]`).classList.add('active');
}

// Adiciona eventos de clique nos links de navegação
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const secaoId = e.target.getAttribute('data-section');
        navegarPara(secaoId);
    });
});

// Inicializa na seção "inicio"
document.addEventListener('DOMContentLoaded', () => {
    updateVerse();
    navegarPara('inicio');
});
