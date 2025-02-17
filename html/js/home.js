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

document.addEventListener('DOMContentLoaded', updateVerse);
setInterval(updateVerse, 24 * 60 * 60 * 1000);
