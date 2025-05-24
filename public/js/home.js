const verses = [
    "\"A paz deixo convosco, a minha paz vos dou.\" - João 14:27",
    "\"O Senhor é a minha luz e a minha salvação.\" - Salmos 27:1",
    "\"Grandes coisas fez o Senhor por nós, e por isso estamos alegres.\" - Salmos 126:3",
    "\"Porque os meus pensamentos não são os vossos pensamentos, nem os vossos caminhos os meus caminhos, diz o Senhor.\" - Isaías 55:8",
    "\"Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.\" - Provérbios 3:5",
    "\"O Senhor é o meu pastor, nada me faltará.\" - Salmos 23:1"
];

function updateVerse() {
    const verse = verses[Math.floor(Math.random() * verses.length)];
    const verseElement = document.getElementById('verse');
    if (verseElement) {
        verseElement.textContent = verse;
    }
}

// Função global para o newsletter (para funcionar com o onsubmit no HTML)
window.subscribeNewsletter = function(event) {
    event.preventDefault();
    const email = event.target.querySelector('input[type="email"]').value;
    if (email) {
        alert(`Obrigado por se inscrever! Suas reflexões serão enviadas para ${email}`);
        event.target.reset();
    } else {
        alert('Por favor, digite um e-mail válido.');
    }
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

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('Home.js carregado');
    updateVerse();
    navegarPara('inicio');
});

// Atualizar versículo a cada 30 segundos
setInterval(updateVerse, 30000);
