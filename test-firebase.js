import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCjCtNqkApJGiC12KlykzzBTZ2AsOkXnwo",
  authDomain: "swear-jar-e8069.firebaseapp.com",
  projectId: "swear-jar-e8069",
  storageBucket: "swear-jar-e8069.firebasestorage.app",
  messagingSenderId: "952518136551",
  appId: "1:952518136551:web:b7bc89a067e7d5abdfc842"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  try {
    const userCred = await signInAnonymously(auth);
    console.log("Signed in anonymously:", userCred.user.uid);
    
    const infractionsRef = collection(db, 'artifacts', 'my-swear-jar-app', 'public', 'data', 'infractions');
    const docRef = await addDoc(infractionsRef, {
      userId: userCred.user.uid,
      userName: 'Test Bot',
      type: 'Can\'t',
      notes: 'Testing notes',
      timestamp: serverTimestamp()
    });
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error: ", e);
  }
  process.exit(0);
}

test();
