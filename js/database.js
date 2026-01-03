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
    },

    // EXPORT - Télécharger toutes les données en JSON
    async exportData() {
        try {
            const all = await this.getAll();
            
            if (all.length === 0) {
                ui.showAlert('Aucune réexpédition à exporter', 'warning');
                return;
            }

            // Créer l'objet d'export
            const exportData = {
                version: '1.0',
                date_export: new Date().toISOString(),
                nombre_reexpeditions: all.length,
                data: all.map(r => ({
                    type: r.type,
                    nom: r.nom,
                    ancienneAdresse: r.ancienneAdresse,
                    nouvelleAdresse: r.nouvelleAdresse,
                    dateDebut: r.dateDebut,
                    dateFin: r.dateFin
                }))
            };

            // Convertir en JSON
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            
            // Créer le lien de téléchargement
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const filename = `reexpeditions_${new Date().toISOString().split('T')[0]}.json`;
            
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            ui.showAlert(`✅ ${all.length} réexpédition(s) exportée(s)`, 'success');
            console.log(`📤 Export réussi: ${filename}`);

        } catch (error) {
            console.error('❌ Erreur export:', error);
            ui.showAlert('Erreur lors de l\'export', 'error');
        }
    },

    // IMPORT - Charger des données depuis un fichier JSON
    async importData(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;

            ui.showLoading(true);

            // Lire le fichier
            const text = await file.text();
            const importedData = JSON.parse(text);

            // Valider le format
            if (!importedData.version || !importedData.data || !Array.isArray(importedData.data)) {
                throw new Error('Format de fichier invalide');
            }

            // Récupérer le mode d'import
            const mode = document.querySelector('input[name="import-mode"]:checked').value;
            
            let added = 0;
            let duplicates = 0;

            // Mode REMPLACER : vider la base d'abord
            if (mode === 'replace') {
                const all = await this.getAll();
                for (const item of all) {
                    await this.delete(item.id);
                }
                console.log('🗑️ Base de données vidée');
            }

            // Mode FUSIONNER : vérifier les doublons
            const existing = await this.getAll();
            const existingNames = new Set(existing.map(r => r.nom.toLowerCase()));

            // Importer les données
            for (const item of importedData.data) {
                // Valider les champs obligatoires
                if (!item.type || !item.nom || !item.ancienneAdresse || 
                    !item.nouvelleAdresse || !item.dateDebut || !item.dateFin) {
                    console.warn('⚠️ Item incomplet ignoré:', item);
                    continue;
                }

                // Vérifier les doublons en mode fusionner
                if (mode === 'merge' && existingNames.has(item.nom.toLowerCase())) {
                    duplicates++;
                    console.log('⚠️ Doublon ignoré:', item.nom);
                    continue;
                }

                // Ajouter à la base
                await this.add(item);
                added++;
            }

            ui.hideImportDialog();
            ui.showLoading(false);

            // Message de confirmation
            let message = `✅ ${added} réexpédition(s) importée(s)`;
            if (duplicates > 0) {
                message += ` • ${duplicates} doublon(s) ignoré(s)`;
            }
            ui.showAlert(message, 'success');

            // Mettre à jour l'affichage
            await ui.updateStats();
            
            // Réinitialiser l'input file
            event.target.value = '';

            console.log(`📥 Import réussi: ${added} ajoutées, ${duplicates} doublons`);

        } catch (error) {
            ui.showLoading(false);
            ui.hideImportDialog();
            console.error('❌ Erreur import:', error);
            ui.showAlert(`Erreur lors de l'import: ${error.message}`, 'error');
        }
    }
};
