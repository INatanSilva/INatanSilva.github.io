import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyBg-r1Ui8RPYSfWRSozmPkSYVRhBBMFeqw",
    authDomain: "reflexoes-da-fe.firebaseapp.com",
    projectId: "reflexoes-da-fe",
    storageBucket: "reflexoes-da-fe.firebasestorage.app",
    messagingSenderId: "384516829244",
    appId: "1:384516829244:web:3d2351f612d3ab48de9339"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

export { app, auth, db }; 