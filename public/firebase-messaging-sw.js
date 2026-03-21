// Import and configure the Firebase SDK
// These scripts are made available when the app is served or deployed on Firebase Hosting
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB7JmfGxu1P8tU-jp0PSM3AH7XXHjoydGQ",
  authDomain: "shopping-list-app-1718.firebaseapp.com",
  projectId: "shopping-list-app-1718",
  storageBucket: "shopping-list-app-1718.firebasestorage.app",
  messagingSenderId: "969953753780",
  appId: "1:969953753780:web:05e04cf409b3a323d775e1"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
