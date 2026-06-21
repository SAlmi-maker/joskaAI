// ============================================================
// RENVA - Firebase Configuration
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAjYdkWCWsBmlhDOLx_PG8hmEw5DKU1I-c",
  authDomain: "renva-ebb4d.firebaseapp.com",
  projectId: "renva-ebb4d",
  storageBucket: "renva-ebb4d.firebasestorage.app",
  messagingSenderId: "5091704809",
  appId: "1:5091704809:web:a73910ab6858ca6b461578",
  measurementId: "G-TB51N3CS0E"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth     = firebase.auth();
const db       = firebase.firestore();
const storage  = firebase.storage();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence unavailable (multiple tabs open).');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported in this browser.');
  }
});
