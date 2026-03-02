self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'Market Alert', {
            body: data.body || 'New item found!',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: data.tag || 'market-alert',
            renotify: true,
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/market'));
});
