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
        const upperText = text.toUpperCase();
        // Recherche plus tolérante avec des variantes OCR
        if (upperText.includes('TEMPORAIRE') || upperText.includes('TEMPORAIR')) return 'TEMPORAIRE';
        if (upperText.includes('DÉFINITIVE') || upperText.includes('DEFINITIVE') || 
            upperText.includes('DEFINITIV') || upperText.includes('DEFINITIF')) return 'DÉFINITIVE';
        return null;
    },

    // Extraire le nom du destinataire
    extractNom(text) {
        // Méthode 1: Chercher après "Et Serv" ou numéros de service
        const patterns = [
            /(?:Et Serv|serv)\s*[12]\s*\d{8,10}\s+[^\n]*\n\s*([A-Z][A-Z\s\-]{5,})/i,
            /MME\s+([A-Z][A-Z\s\-]+)/i,
            /M\.\s+([A-Z][A-Z\s\-]+)/i,
            /MR\s+([A-Z][A-Z\s\-]+)/i,
            /MONSIEUR\s+([A-Z][A-Z\s\-]+)/i,
            /MADAME\s+([A-Z][A-Z\s\-]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let nom = match[1].trim();
                // Nettoyer (enlever les lignes suivantes si présentes)
                nom = nom.split(/\d{5}/)[0].trim();
                nom = nom.split(/RUE|AVENUE|ALLEE|CHEMIN|RESIDENCE/i)[0].trim();
                // Enlever les caractères parasites
                nom = nom.replace(/[^A-Z\s\-]/g, '').trim();
                if (nom.length > 5 && nom.length < 100) {
                    return nom;
                }
            }
        }

        // Méthode 2: Chercher une séquence de mots en majuscules (nom probable)
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Ligne avec plusieurs mots en majuscules, pas de chiffres
            if (/^[A-Z][A-Z\s\-]{10,}$/.test(line) && !/\d/.test(line)) {
                const nom = line.replace(/[^A-Z\s\-]/g, '').trim();
                if (nom.length > 10 && nom.length < 100) {
                    return nom;
                }
            }
        }

        return null;
    },

    // Extraire l'ancienne adresse
    extractAncienneAdresse(text) {
        // Chercher DESTINATAIRE suivi d'une adresse
        const destPattern = /DESTINATAIRE[^\n]*\n\s*([^\n]+)\n\s*(\d{5})\s+([A-Z\s]+)/i;
        const destMatch = text.match(destPattern);
        if (destMatch) {
            return `${destMatch[1].trim()}, ${destMatch[2]} ${destMatch[3].trim()}`;
        }

        // Chercher l'adresse après le nom et avant "nouveau contrat" ou "NOUVELLE"
        const addrPattern = /([A-Z0-9\s,\-]+)\s+(\d{5})\s+([A-Z\s]+)\s+(?:nouveau contrat|NOUVELLE|DESTINATAIRE)/i;
        const addrMatch = text.match(addrPattern);
        if (addrMatch) {
            const addr = `${addrMatch[1].trim()}, ${addrMatch[2]} ${addrMatch[3].trim()}`;
            if (addr.length < 200) {
                return addr;
            }
        }

        // Méthode alternative : chercher une adresse avec code postal (5 chiffres)
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const cpMatch = line.match(/(\d{5})/);
            if (cpMatch && i > 0) {
                // Prendre la ligne précédente (rue) + cette ligne (CP + ville)
                const rue = lines[i-1].trim();
                const cpVille = line.trim();
                if (rue.length > 3 && rue.length < 100) {
                    return `${rue}, ${cpVille}`;
                }
            }
        }

        return null;
    },

    // Extraire la nouvelle adresse
    extractNouvelleAdresse(text) {
        // Chercher après "NOUVELLE ADR" ou "nouveau contrat"
        const patterns = [
            /NOUVELLE\s+ADR[^\n]*\n\s*([^\n]+)\n\s*(\d{5})\s+([A-Z\s]+)/i,
            /nouveau\s+contrat[^\n]*\n\s*([A-Z\s]+)?\s*([A-Z0-9\s,\-]+)\n\s*(\d{5})\s+([A-Z\s]+)\s+FRANCE/i,
            /NOUVELLE\s+ADRESSE[^\n]*\n\s*([^\n]+)\n\s*(\d{5})\s+([A-Z\s]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                // Prendre les derniers groupes (adresse, CP, ville)
                const groups = match.slice(-3);
                const addr = groups.join(' ').trim().replace(/\s+/g, ' ');
                if (addr.length > 10 && addr.length < 200) {
                    return addr;
                }
            }
        }

        // Méthode alternative: chercher la deuxième occurrence d'un code postal
        const cpMatches = [...text.matchAll(/(\d{5})/g)];
        if (cpMatches.length >= 2) {
            // Prendre la zone autour du deuxième code postal
            const secondCpIndex = cpMatches[1].index;
            const substring = text.substring(Math.max(0, secondCpIndex - 100), secondCpIndex + 50);
            const lines = substring.split('\n').slice(-3);
            if (lines.length >= 2) {
                return lines.join(' ').trim().replace(/\s+/g, ' ');
            }
        }

        return null;
    },

    // Extraire les dates
    extractDates(text) {
        // Format: Temporaire 06/12/2024 au 05/12/2025
        // ou: Définitif 03/05/2025 au 29/11/2025
        const pattern = /(Temporaire|Temporair|Définitif|Definitif)[^\d]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})[^\d]+(au|à)[^\d]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i;
        const match = text.match(pattern);

        if (match) {
            const dateDebut = this.convertDate(match[2].replace('-', '/'));
            const dateFin = this.convertDate(match[4].replace('-', '/'));
            return { debut: dateDebut, fin: dateFin };
        }

        // Méthode alternative: chercher deux dates au format DD/MM/YYYY
        const datePattern = /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/g;
        const dates = [...text.matchAll(datePattern)];
        
        if (dates.length >= 2) {
            const dateDebut = this.convertDate(dates[0][0].replace('-', '/'));
            const dateFin = this.convertDate(dates[1][0].replace('-', '/'));
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
