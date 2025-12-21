// Gestion de l'interface utilisateur

const ui = {

    // Afficher un écran
    showScreen(screenName) {
        // Masquer tous les écrans
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Afficher l'écran demandé
        const screen = document.getElementById(`${screenName}-screen`);
        if (screen) {
            screen.classList.add('active');

            // Démarrer la caméra si nécessaire
            if (screenName === 'scan-register') {
                scanner.startCamera('register');
            } else if (screenName === 'scan-check') {
                scanner.startCamera('check');
            }

            // Charger la liste si nécessaire
            if (screenName === 'list') {
                this.loadList('all');
            }
        }
    },

    // Afficher/masquer le loading
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.add('active');
        } else {
            loading.classList.remove('active');
        }
    },

    // Afficher une alerte
    showAlert(message, type) {
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800',
            info: '#2196F3'
        };

        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 2000;
            font-size: 16px;
            max-width: 90%;
            text-align: center;
        `;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    },

    // Mettre à jour les statistiques
    async updateStats() {
        const all = await database.getAll();
        const expiring = await database.getExpiringSoon();

        document.getElementById('total-count').textContent = all.length;
        document.getElementById('expiring-count').textContent = expiring.length;
    },

    // Charger la liste des réexpéditions
    async loadList(filterType = 'all') {
        const listDiv = document.getElementById('reexp-list');
        listDiv.innerHTML = '<p style="text-align:center; color:#888;">Chargement...</p>';

        try {
            const reexps = await database.filterByType(filterType);

            if (reexps.length === 0) {
                listDiv.innerHTML = '<p style="text-align:center; color:#888;">Aucune réexpédition</p>';
                return;
            }

            // Trier par date de fin (les plus proches en premier)
            reexps.sort((a, b) => new Date(a.dateFin) - new Date(b.dateFin));

            listDiv.innerHTML = '';

            reexps.forEach(r => {
                const typeClass = r.type === 'TEMPORAIRE' ? 'temporaire' : 'definitive';
                const daysLeft = search.daysUntil(r.dateFin);
                const expiringWarning = daysLeft <= 7 && daysLeft >= 0
                    ? `<div class="expiring-soon">⚠️ Expire dans ${daysLeft} jour(s)</div>`
                    : '';

                const item = document.createElement('div');
                item.className = `reexp-item ${typeClass}`;
                item.innerHTML = `
                    <div class="header">
                        <span class="type-badge ${typeClass}">${r.type}</span>
                    </div>
                    <div class="name">${r.nom}</div>
                    <div class="address">📍 ${r.ancienneAdresse}</div>
                    <div class="address" style="margin-top:8px; color:#2196F3;">
                        📮 ${r.nouvelleAdresse}
                    </div>
                    <div class="dates">
                        Du ${search.formatDate(r.dateDebut)} au ${search.formatDate(r.dateFin)}
                    </div>
                    ${expiringWarning}
                    <button class="delete-btn" onclick="ui.deleteReexpedition(${r.id})">
                        🗑️ Supprimer
                    </button>
                `;
                listDiv.appendChild(item);
            });

        } catch (error) {
            console.error('Erreur chargement liste:', error);
            listDiv.innerHTML = '<p style="text-align:center; color:#f44336;">Erreur de chargement</p>';
        }
    },

    // Filtrer la liste
    filterList(type) {
        // Mettre à jour les boutons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // Charger la liste filtrée
        this.loadList(type);
    },

    // Supprimer une réexpédition
    async deleteReexpedition(id) {
        if (!confirm('Supprimer cette réexpédition ?')) return;

        try {
            await database.delete(id);
            this.showAlert('Réexpédition supprimée', 'success');
            await this.updateStats();
            await this.loadList('all');
        } catch (error) {
            console.error('Erreur suppression:', error);
            this.showAlert('Erreur lors de la suppression', 'error');
        }
    },

    // Afficher la liste des réexpéditions qui expirent bientôt
    async showExpiringList() {
        const expiring = await database.getExpiringSoon();

        if (expiring.length === 0) {
            this.showAlert('Aucune réexpédition n\'expire bientôt', 'info');
            return;
        }

        this.showScreen('list');
        const listDiv = document.getElementById('reexp-list');
        listDiv.innerHTML = '<h3 style="margin-bottom:15px;">⚠️ Expirent bientôt (7 jours)</h3>';

        expiring.forEach(r => {
            const typeClass = r.type === 'TEMPORAIRE' ? 'temporaire' : 'definitive';
            const daysLeft = search.daysUntil(r.dateFin);

            const item = document.createElement('div');
            item.className = `reexp-item ${typeClass}`;
            item.innerHTML = `
                <div class="header">
                    <span class="type-badge ${typeClass}">${r.type}</span>
                </div>
                <div class="name">${r.nom}</div>
                <div class="address">📍 ${r.ancienneAdresse}</div>
                <div class="address" style="margin-top:8px; color:#2196F3;">
                    📮 ${r.nouvelleAdresse}
                </div>
                <div class="dates">
                    Expire dans ${daysLeft} jour(s) (${search.formatDate(r.dateFin)})
                </div>
                <div class="expiring-soon">⚠️ ATTENTION : Expiration proche</div>
            `;
            listDiv.appendChild(item);
        });
    }
};