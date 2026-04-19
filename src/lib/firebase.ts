import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCEXSpT2oODyKR9c4i320sItCgivkXqsxU",
  authDomain: "ukelonn-1cdbf.firebaseapp.com",
  projectId: "ukelonn-1cdbf",
  storageBucket: "ukelonn-1cdbf.appspot.com",
  messagingSenderId: "775837524786",
  appId: "1:775837524786:web:04b45500b222c815c1bad2",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);