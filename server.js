const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const port = process.env.PORT || 3000;
const app = express();

// 🔒 Vérification des variables d'environnement
if (!process.env.FIREBASE_CREDENTIALS || !process.env.USER || !process.env.PASS || !process.env.MON_MAIL) {
    throw new Error("⚠️ Erreur : Une ou plusieurs variables d'environnement ne sont pas définies !");
}

// 🔥 Chargement sécurisé de Firebase

const serviceAccountPath = process.env.FIREBASE_CREDENTIALS;
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Middleware
app.use(express.static("public")).use(bodyParser.json()).use(cors());

// 📩 Configuration de Nodemailer (Transporter Gmail sécurisé)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.USER,
        pass: process.env.PASS,
    },
});

// 🔑 Génération d'un identifiant aléatoire sécurisé
const generateReference = () => crypto.randomBytes(8).toString("hex");

// 🔥 Route pour effectuer un virement
app.post("/virement", async (req, res) => {
    const { nom, prenom, iban, swift, code_banque, montant, libelle } = req.body;

    if (!nom || !prenom || !iban || !swift || !code_banque || !montant || !libelle) {
        return res.status(400).json({ message: "Veuillez remplir tous les champs." });
    }

    const soldeRef = db.collection("solde").doc("montant");
    const soldeSnap = await soldeRef.get();

    if (!soldeSnap.exists) {
        return res.status(400).json({ message: "Solde introuvable." });
    }

    const soldeActuel = soldeSnap.data().montant;
    if (soldeActuel < montant) {
        return res.status(400).json({ message: "Solde insuffisant !" });
    }

    const nouveauSolde = soldeActuel - montant;
    await soldeRef.update({ montant: nouveauSolde });

    const dateTransaction = new Date().toLocaleDateString();
    const reference = generateReference();

    try {
        const userRef = await db.collection("users").add({
            nom,
            prenom,
            iban,
            swift,
            code_banque,
            montant,
            libelle,
            date: dateTransaction,
            statut: "En attente",
            type: "Débit",
        });

        // 📩 Envoi de l'email de confirmation
        const mailOptions = {
            from: process.env.USER,
            to: process.env.MON_MAIL,
            subject: "Reçu de virement",
            html: `
                <html>
                <body>
                    <h1>Confirmation de votre virement bancaire</h1>
                    <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
                    <p>Nous confirmons que votre virement a bien été enregistré.</p>
                    <ul>
                        <li><strong>Montant :</strong> ${montant} €</li>
                        <li><strong>Date :</strong> ${dateTransaction}</li>
                        <li><strong>Référence du virement :</strong> ${reference}</li>
                    </ul>
                    <p>Merci pour votre confiance.</p>
                </body>
                </html>
            `,
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.error("Erreur d'envoi d'email :", error);
                return res.status(500).json({ success: false, message: "Erreur d'envoi de l'email." });
            }
            console.log("Email envoyé :", info.response);
            res.status(201).json({ success: true, message: "Virement effectué avec succès !" });
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🔥 Route pour récupérer le solde
app.get("/montant", async (req, res) => {
    const soldeRef = db.collection("solde").doc("montant");
    const soldeSnap = await soldeRef.get();

    if (!soldeSnap.exists) {
        return res.status(400).json({ message: "Impossible de récupérer le solde." });
    }

    try {
        const solde = soldeSnap.data().montant;
        res.status(200).json({ message: "Solde récupéré avec succès", solde });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 🔥 Route pour récupérer toutes les transactions
app.get("/totalvirements", async (req, res) => {
    const usersRef = db.collection("users");
    const snapVirement = await usersRef.get();

    if (snapVirement.empty) {
        return res.status(400).json({ message: "Aucune transaction trouvée." });
    }

    try {
        const transactions = [];
        snapVirement.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json({ message: "Transactions récupérées avec succès", transactions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 🚀 Démarrage du serveur
app.listen(port, () => {
    console.log(`✅ Serveur démarré sur le port ${port}`);
});
