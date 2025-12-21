// Point d'entrée de l'application

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Application démarrée');

    // Initialiser la base de données
    await database.init();

    // Mettre à jour les statistiques
    await ui.updateStats();

    // Nettoyer les réexpéditions expirées au démarrage
    await database.cleanExpired();

    // Enregistrer le Service Worker pour le mode offline
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
            console.log('✅ Service Worker enregistré');
        } catch (error) {
            console.error('❌ Erreur Service Worker:', error);
        }
    }

    console.log('✅ Application prête');
});

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Erreur globale:', event.error);
    ui.showAlert('Une erreur est survenue', 'error');
});

// Gestion de la perte de connexion
window.addEventListener('online', () => {
    console.log('📡 Connexion rétablie');
});

window.addEventListener('offline', () => {
    console.log('📡 Mode hors ligne');
});