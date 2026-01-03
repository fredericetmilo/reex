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
        // Nettoyer le texte
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Méthode 1: Chercher après les numéros de service
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Si on trouve "Et serv" ou un numéro de service
            if (/Et\s*[Ss]erv|serv\s*[12]|\d{10}/i.test(line)) {
                // Le nom est probablement dans les 2-3 lignes suivantes
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const candidateLine = lines[j];
                    
                    // Chercher une ligne avec M, MME, MR, MLE suivis d'un nom
                    const nameMatch = candidateLine.match(/(?:M\s+|MME\s+|MR\s+|MLE\s+|MONSIEUR\s+|MADAME\s+)([A-Z][A-Z\s\-]{5,})/i);
                    if (nameMatch) {
                        let nom = nameMatch[0].trim();
                        // Nettoyer
                        nom = nom.replace(/[^A-Z\s\-]/g, ' ').replace(/\s+/g, ' ').trim();
                        if (nom.length >= 8 && nom.length < 100) {
                            return nom;
                        }
                    }
                    
                    // Ou une ligne en majuscules qui ressemble à un nom (sans chiffres)
                    if (/^[A-Z][A-Z\s\-]{10,}$/.test(candidateLine) && !/\d/.test(candidateLine)) {
                        const nom = candidateLine.replace(/[^A-Z\s\-]/g, ' ').replace(/\s+/g, ' ').trim();
                        if (nom.length >= 10 && nom.length < 100) {
                            return nom;
                        }
                    }
                }
            }
        }

        // Méthode 2: Chercher toutes les lignes avec M/MME
        const patterns = [
            /(?:M\s+|MME\s+|MR\s+|MLE\s+)([A-Z][A-Z\s\-]{5,})/gi
        ];

        for (const pattern of patterns) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                let nom = matches[0][0].trim();
                nom = nom.replace(/[^A-Z\s\-]/g, ' ').replace(/\s+/g, ' ').trim();
                if (nom.length >= 8 && nom.length < 100) {
                    return nom;
                }
            }
        }

        return null;
    },

    // Extraire l'ancienne adresse
    extractAncienneAdresse(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Chercher "DESTINATAIRE" et prendre les lignes au-dessus
        for (let i = 0; i < lines.length; i++) {
            if (/DESTINATAIRE/i.test(lines[i])) {
                // Prendre les 2-3 lignes précédentes
                const potentialAddr = [];
                for (let j = Math.max(0, i - 3); j < i; j++) {
                    const line = lines[j];
                    // Ignorer les lignes avec "Et Serv", noms, etc.
                    if (!/Et\s*Serv|\d{10}|^M\s|^MME\s|^MR\s/i.test(line)) {
                        potentialAddr.push(line);
                    }
                }
                
                // Chercher rue + code postal
                const addrText = potentialAddr.join(' ');
                const cpMatch = addrText.match(/([A-Z0-9\s,\-]+?)\s*(\d{5})\s+([A-Z\s]+)/i);
                if (cpMatch) {
                    return `${cpMatch[1].trim()}, ${cpMatch[2]} ${cpMatch[3].trim()}`;
                }
            }
        }

        // Méthode alternative : trouver le premier code postal et son contexte
        for (let i = 0; i < lines.length; i++) {
            const cpMatch = lines[i].match(/(\d{5})/);
            if (cpMatch && i > 0) {
                const rue = lines[i - 1];
                const cpVille = lines[i];
                // Vérifier que c'est bien une adresse (pas un numéro de service)
                if (rue.length > 5 && /RUE|AVENUE|ALLEE|BOULEVARD|CHEMIN|IMPASSE/i.test(rue)) {
                    return `${rue.trim()}, ${cpVille.trim()}`;
                }
            }
        }

        return null;
    },

    // Extraire la nouvelle adresse
    extractNouvelleAdresse(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Chercher "NOUVELLE ADRESSE" ou juste après "DESTINATAIRE"
        let startIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/NOUVELLE\s*ADRESSE/i.test(lines[i])) {
                startIdx = i + 1;
                break;
            }
        }
        
        // Si pas trouvé, chercher après DESTINATAIRE et FRANCE
        if (startIdx === -1) {
            for (let i = 0; i < lines.length; i++) {
                if (/DESTINATAIRE/i.test(lines[i])) {
                    startIdx = i + 1;
                    break;
                }
            }
        }
        
        if (startIdx !== -1) {
            // Collecter les lignes qui semblent être une adresse
            const addrLines = [];
            for (let i = startIdx; i < Math.min(startIdx + 6, lines.length); i++) {
                const line = lines[i];
                // Ignorer les lignes avec dates, "Définitif", "Temporaire", etc.
                if (!/Définitif|Temporaire|QLAA|TL\s*\d{4}|\d{2}\/\d{2}\/\d{4}/i.test(line)) {
                    addrLines.push(line);
                }
                // Arrêter si on trouve FRANCE
                if (/FRANCE/i.test(line)) {
                    addrLines.push(line);
                    break;
                }
            }
            
            // Joindre et nettoyer
            const fullAddr = addrLines.join(' ').replace(/\s+/g, ' ').trim();
            
            // Extraire adresse + CP + ville
            const cpMatch = fullAddr.match(/([A-Z0-9\s,\-]+?)\s*(\d{5})\s+([A-Z\s]+)/i);
            if (cpMatch) {
                return `${cpMatch[1].trim()}, ${cpMatch[2]} ${cpMatch[3].trim()}`.replace(/\s+/g, ' ');
            }
            
            if (fullAddr.length > 15 && fullAddr.length < 300) {
                return fullAddr;
            }
        }

        // Méthode alternative: chercher le deuxième code postal
        const cpMatches = [];
        for (let i = 0; i < lines.length; i++) {
            if (/\d{5}/.test(lines[i])) {
                cpMatches.push({ index: i, line: lines[i] });
            }
        }
        
        if (cpMatches.length >= 2) {
            const secondCp = cpMatches[1];
            const addrLines = [];
            for (let i = Math.max(0, secondCp.index - 3); i <= secondCp.index + 1; i++) {
                if (i < lines.length && !/DESTINATAIRE|Définitif|Temporaire/i.test(lines[i])) {
                    addrLines.push(lines[i]);
                }
            }
            const addr = addrLines.join(' ').replace(/\s+/g, ' ').trim();
            if (addr.length > 15 && addr.length < 300) {
                return addr;
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
