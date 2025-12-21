// Gestion de la caméra et de l'OCR

const scanner = {
    streams: {},

    // Démarrer la caméra
    async startCamera(mode) {
        try {
            const video = document.getElementById(`video-${mode}`);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            video.srcObject = stream;
            this.streams[mode] = stream;
            console.log(`📷 Caméra démarrée (${mode})`);
        } catch (error) {
            console.error('❌ Erreur caméra:', error);
            ui.showAlert('Impossible d\'accéder à la caméra', 'error');
        }
    },

    // Arrêter la caméra
    stopCamera(mode) {
        const stream = this.streams[mode];
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            delete this.streams[mode];
            console.log(`📷 Caméra arrêtée (${mode})`);
        }
        ui.showScreen('home');
    },

    // Capturer l'image et lancer l'OCR
    async captureAndProcess(mode) {
        ui.showLoading(true);

        try {
            const video = document.getElementById(`video-${mode}`);
            const canvas = document.getElementById(`canvas-${mode}`);
            const context = canvas.getContext('2d');

            // Définir les dimensions du canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Capturer l'image
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convertir en image
            const imageData = canvas.toDataURL('image/png');

            // Lancer l'OCR
            console.log('🔍 Lancement de l\'OCR...');
            const text = await this.runOCR(imageData);

            // Traiter selon le mode
            if (mode === 'register') {
                await this.processRegister(text);
            } else if (mode === 'check') {
                await this.processCheck(text);
            }

        } catch (error) {
            console.error('❌ Erreur capture:', error);
            ui.showAlert('Erreur lors de la capture', 'error');
        } finally {
            ui.showLoading(false);
        }
    },

    // Exécuter Tesseract OCR
    async runOCR(imageData) {
        const { data: { text } } = await Tesseract.recognize(
            imageData,
            'fra',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );
        return text;
    },

    // Traiter l'enregistrement d'un carton
    async processRegister(text) {
        console.log('📄 Texte extrait:', text);

        // Parser le texte
        const data = parser.parseCarton(text);

        if (data) {
            // Afficher les résultats
            const resultDiv = document.getElementById('ocr-result-register');
            resultDiv.innerHTML = `
                <div class="result-card found">
                    <h3>✅ Carton détecté</h3>
                    <p><strong>Type:</strong> ${data.type}</p>
                    <p><strong>Nom:</strong> ${data.nom}</p>
                    <p><strong>Ancienne adresse:</strong> ${data.ancienneAdresse}</p>
                    <p><strong>Nouvelle adresse:</strong> ${data.nouvelleAdresse}</p>
                    <p><strong>Période:</strong> ${data.dateDebut} → ${data.dateFin}</p>
                    <button class="action-btn primary" onclick="scanner.saveReexpedition(${JSON.stringify(data).replace(/"/g, '&quot;')})">
                        💾 Enregistrer
                    </button>
                </div>
            `;
            this.stopCamera('register');
        } else {
            ui.showAlert('Impossible de lire le carton. Réessayez.', 'error');
        }
    },

    // Enregistrer la réexpédition
    async saveReexpedition(data) {
        try {
            await database.add(data);
            ui.showAlert('✅ Réexpédition enregistrée', 'success');
            await ui.updateStats();
            ui.showScreen('home');
        } catch (error) {
            console.error('❌ Erreur sauvegarde:', error);
            ui.showAlert('Erreur lors de l\'enregistrement', 'error');
        }
    },

    // Traiter la vérification d'un colis
    async processCheck(text) {
        console.log('🔍 Recherche dans:', text);

        // Extraire les noms potentiels du texte
        const names = parser.extractNames(text);

        if (names.length === 0) {
            ui.showAlert('Aucun nom détecté. Utilisez la recherche manuelle.', 'warning');
            return;
        }

        // Rechercher chaque nom
        const resultDiv = document.getElementById('search-result');
        resultDiv.innerHTML = '';

        for (const name of names) {
            const results = await database.searchByName(name);

            if (results.length > 0) {
                results.forEach(r => {
                    resultDiv.innerHTML += `
                        <div class="result-card found">
                            <h3>✅ Réexpédition trouvée !</h3>
                            <p><strong>${r.nom}</strong></p>
                            <p class="address">📍 Ancienne: ${r.ancienneAdresse}</p>
                            <div class="new-address">
                                📮 NOUVELLE ADRESSE:<br>
                                ${r.nouvelleAdresse}
                            </div>
                            <p style="margin-top:10px; font-size:13px; color:#888;">
                                Type: ${r.type} • Expire le ${r.dateFin}
                            </p>
                        </div>
                    `;
                });
                this.stopCamera('check');
                return;
            }
        }

        resultDiv.innerHTML = `
            <div class="result-card not-found">
                <h3>❌ Aucune réexpédition</h3>
                <p>Aucune réexpédition active trouvée pour ce nom.</p>
            </div>
        `;
        this.stopCamera('check');
    }
};