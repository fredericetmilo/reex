// Gestion de la recherche

const search = {

    // Recherche manuelle par saisie
    async manualSearch() {
        const input = document.getElementById('manual-search');
        const searchTerm = input.value.trim();

        if (!searchTerm) {
            ui.showAlert('Entrez un nom à rechercher', 'warning');
            return;
        }

        ui.showLoading(true);

        try {
            const results = await database.searchByName(searchTerm);
            const resultDiv = document.getElementById('search-result');
            resultDiv.innerHTML = '';

            if (results.length > 0) {
                results.forEach(r => {
                    const expiringClass = this.isExpiringSoon(r.dateFin) ? 'expiring-soon' : '';

                    resultDiv.innerHTML += `
                        <div class="result-card found">
                            <h3>✅ Réexpédition trouvée !</h3>
                            <p><strong>${r.nom}</strong></p>
                            <p class="address">📍 Ancienne: ${r.ancienneAdresse}</p>
                            <div class="new-address">
                                📮 NOUVELLE ADRESSE:<br>
                                ${r.nouvelleAdresse}
                            </div>
                            <p style="margin-top:10px; font-size:13px;">
                                <span style="background:${r.color}; color:white; padding:3px 8px; border-radius:4px;">
                                    ${r.type}
                                </span>
                                <br>
                                Expire le ${this.formatDate(r.dateFin)}
                            </p>
                            ${expiringClass ? '<p class="expiring-soon">⚠️ Expire bientôt !</p>' : ''}
                        </div>
                    `;
                });
            } else {
                resultDiv.innerHTML = `
                    <div class="result-card not-found">
                        <h3>❌ Aucune réexpédition</h3>
                        <p>Aucune réexpédition active trouvée pour "${searchTerm}"</p>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Erreur recherche:', error);
            ui.showAlert('Erreur lors de la recherche', 'error');
        } finally {
            ui.showLoading(false);
        }
    },

    // Vérifier si une date expire bientôt (dans les 7 jours)
    isExpiringSoon(dateStr) {
        const expDate = new Date(dateStr);
        const today = new Date();
        const sevenDays = new Date(today);
        sevenDays.setDate(sevenDays.getDate() + 7);

        return expDate >= today && expDate <= sevenDays;
    },

    // Formater une date YYYY-MM-DD en DD/MM/YYYY
    formatDate(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    },

    // Calculer les jours restants
    daysUntil(dateStr) {
        const expDate = new Date(dateStr);
        const today = new Date();
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
};