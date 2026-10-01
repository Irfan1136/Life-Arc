// Firebase web config for the Challenge section (these values are not secrets; firestore.rules protects the data).
export const firebaseConfig = {
  apiKey: "AIzaSyCagJu7-bETi6i-9R2PkQJd81KOrMo8lTE",
  authDomain: "life-arc-d31e6.firebaseapp.com",
  projectId: "life-arc-d31e6",
  storageBucket: "life-arc-d31e6.firebasestorage.app",
  messagingSenderId: "422265242699",
  appId: "1:422265242699:web:ae3b90ac8e46bee4d379ce",
};

// Optional: link to download the APK (your GitHub Releases page). It is added to the WhatsApp invite text.
export const APP_LINK = "";

export const configured = () => !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
