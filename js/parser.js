// Parser pour analyser le texte OCR des cartons

const parser = {

    // Parser principal pour les cartons de réexpédition
    parseCarton(text) {
        try {
            // Nettoyer le texte
            const cleanText = text.replace(/\s+/g, ' ').trim();

            // Détecter le type
            const type = this.extractType(cleanText);
            if (!type) {
                console.error('Type non détecté');
                return null;
            }

            // Extraire les informations
            const nom = this.extractNom(cleanText);
            const ancienneAdresse = this.extractAncienneAdresse(cleanText);
            const nouvelleAdresse = this.extractNouvelleAdresse(cleanText);
            const dates = this.extractDates(cleanText);

            // Vérifier que toutes les infos sont présentes
            if (!nom || !ancienneAdresse || !nouvelleAdresse || !dates) {
                console.error('Données manquantes:', { nom, ancienneAdresse, nouvelleAdresse, dates });
                return null;
            }

            return {
                type,
                nom,
                ancienneAdresse,
                nouvelleAdresse,
                dateDebut: dates.debut,
                dateFin: dates.fin
            };

        } catch (error) {
            console.error('Erreur parsing:', error);
            return null;
        }
    },

    // Extraire le type (TEMPORAIRE ou DÉFINITIVE)
    extractType(text) {
        if (text.includes('TEMPORAIRE')) return 'TEMPORAIRE';
        if (text.includes('DÉFINITIVE') || text.includes('DEFINITIVE')) return 'DÉFINITIVE';
        return null;
    },

    // Extraire le nom du destinataire
    extractNom(text) {
        // Chercher après "Et Serv 1" et avant l'adresse
        const patterns = [
            /Et Serv 1[^\n]*\n([A-Z\s\-]+)/i,
            /MME\s+([A-Z\s\-]+)/i,
            /M\.\s+([A-Z\s\-]+)/i,
            /MR\s+([A-Z\s\-]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let nom = match[1].trim();
                // Nettoyer (enlever les lignes suivantes si présentes)
                nom = nom.split(/\d{5}/)[0].trim();
                nom = nom.split(/RUE|AVENUE|ALLEE|CHEMIN/i)[0].trim();
                if (nom.length > 5 && nom.length < 100) {
                    return nom;
                }
            }
        }
        return null;
    },

    // Extraire l'ancienne adresse
    extractAncienneAdresse(text) {
        // Chercher l'adresse après le nom et avant "nouveau contrat"
        const match = text.match(/([A-Z0-9\s,\-]+)\s+(\d{5})\s+([A-Z\s]+)\s+nouveau contrat/i);
        if (match) {
            return `${match[1].trim()} ${match[2]} ${match[3].trim()}`;
        }

        // Méthode alternative : chercher une adresse avec code postal
        const addrMatch = text.match(/([A-Z0-9\s,\-]+\d{5}\s+[A-Z\s]+)/i);
        if (addrMatch) {
            const addr = addrMatch[0].trim();
            if (addr.length < 200) {
                return addr;
            }
        }

        return null;
    },

    // Extraire la nouvelle adresse
    extractNouvelleAdresse(text) {
        // Chercher après "nouveau contrat" et avant les dates
        const patterns = [
            /nouveau contrat\s+([A-Z\s]+)?\s*([A-Z0-9\s,\-]+)\s+(\d{5})\s+([A-Z\s]+)\s+FRANCE/i,
            /NOUVELLE ADRESSE\s+([A-Z0-9\s,\-]+)\s+(\d{5})\s+([A-Z\s]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                // Prendre les 3 derniers groupes (adresse, CP, ville)
                const groups = match.slice(-3);
                return groups.join(' ').trim();
            }
        }

        return null;
    },

    // Extraire les dates
    extractDates(text) {
        // Format: Temporaire 06/12/2024 au 05/12/2025
        // ou: Définitif 03/05/2025 au 29/11/2025
        const pattern = /(Temporaire|Définitif)\s+(\d{2}\/\d{2}\/\d{4})\s+au\s+(\d{2}\/\d{2}\/\d{4})/i;
        const match = text.match(pattern);

        if (match) {
            const dateDebut = this.convertDate(match[2]);
            const dateFin = this.convertDate(match[3]);
            return { debut: dateDebut, fin: dateFin };
        }

        return null;
    },

    // Convertir date DD/MM/YYYY vers YYYY-MM-DD
    convertDate(dateStr) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
    },

    // Extraire les noms potentiels d'un texte (pour la recherche)
    extractNames(text) {
        const names = [];

        // Chercher les mots en majuscules (potentiellement des noms)
        const words = text.split(/\s+/);
        let currentName = [];

        for (const word of words) {
            // Si le mot est en majuscules et fait plus de 2 caractères
            if (word === word.toUpperCase() && word.length > 2 && /^[A-Z\-]+$/.test(word)) {
                currentName.push(word);
            } else if (currentName.length > 0) {
                // Fin d'un nom potentiel
                names.push(currentName.join(' '));
                currentName = [];
            }
        }

        // Ajouter le dernier nom si présent
        if (currentName.length > 0) {
            names.push(currentName.join(' '));
        }

        // Filtrer les noms trop courts ou trop longs
        return names.filter(n => n.length >= 5 && n.length <= 50);
    }
};