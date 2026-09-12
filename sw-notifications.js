// Importé par le Service Worker (workbox importScripts).
// Ouvre / met au premier plan l'application quand on touche un rappel de cours.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // À défaut d'URL explicite, on ouvre la portée du Service Worker
  // (la racine du domaine en local, /timer/ une fois déployé).
  const cible = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGUER', url: cible })
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(cible)
    })
  )
})
