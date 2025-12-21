// Gestion de la base de données IndexedDB

const database = {
    db: null,
    dbName: 'ReexpeditionsDB',
    storeName: 'reexpeditions',

    // Initialiser la base de données
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ Base de données initialisée');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    objectStore.createIndex('nom', 'nom', { unique: false });
                    objectStore.createIndex('dateFin', 'dateFin', { unique: false });
                    objectStore.createIndex('type', 'type', { unique: false });
                    console.log('✅ Store créé');
                }
            };
        });
    },

    // Ajouter une réexpédition
    async add(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const reexp = {
                type: data.type,
                nom: data.nom,
                ancienneAdresse: data.ancienneAdresse,
                nouvelleAdresse: data.nouvelleAdresse,
                dateDebut: data.dateDebut,
                dateFin: data.dateFin,
                color: data.type === 'TEMPORAIRE' ? '#f44336' : '#4CAF50',
                dateAjout: new Date().toISOString()
            };

            const request = store.add(reexp);
            request.onsuccess = () => {
                console.log('✅ Réexpédition ajoutée:', reexp.nom);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Récupérer toutes les réexpéditions
    async getAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Rechercher par nom (insensible à la casse)
    async searchByName(name) {
        const all = await this.getAll();
        const searchTerm = name.toLowerCase().trim();
        return all.filter(r =>
            r.nom.toLowerCase().includes(searchTerm)
        );
    },

    // Supprimer une réexpédition
    async delete(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('🗑️ Réexpédition supprimée');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Nettoyer les réexpéditions expirées
    async cleanExpired() {
        const all = await this.getAll();
        const today = new Date().toISOString().split('T')[0];
        let count = 0;

        for (const reexp of all) {
            if (reexp.dateFin < today) {
                await this.delete(reexp.id);
                count++;
            }
        }

        if (count > 0) {
            console.log(`🗑️ ${count} réexpédition(s) expirée(s) supprimée(s)`);
            ui.showAlert(`${count} réexpédition(s) expirée(s) supprimée(s)`, 'success');
            await ui.updateStats();
        } else {
            ui.showAlert('Aucune réexpédition expirée', 'info');
        }
    },

    // Récupérer les réexpéditions qui expirent bientôt (dans les 7 jours)
    async getExpiringSoon() {
        const all = await this.getAll();
        const today = new Date();
        const sevenDays = new Date(today);
        sevenDays.setDate(sevenDays.getDate() + 7);

        return all.filter(r => {
            const expDate = new Date(r.dateFin);
            return expDate >= today && expDate <= sevenDays;
        });
    },

    // Filtrer par type
    async filterByType(type) {
        const all = await this.getAll();
        if (type === 'all') return all;
        return all.filter(r => r.type === type);
    }
};