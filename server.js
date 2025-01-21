const express = require("express")
const bodyParser = require("body-parser")
const nodemailer = require('nodemailer');
const admin = require("firebase-admin")
const cors = require("cors")
const port = 3000
const app = express()

// initialiser firebase-admin a mon projet 
serviceAccount = require("./projet-57d46-firebase-adminsdk-rvtoa-01f51f8bbb.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
const db = admin.firestore()
  // recupération de toutes les dependances
app.use(express.static("public")).use(bodyParser.json())
app.use(cors({
    origin: 'http://localhost:3000', // Permet uniquement les requêtes de localhost:3000
    methods: ['GET', 'POST'], // Si nécessaire, ajustez les méthodes autorisées
    allowedHeaders: ['Content-Type', 'Authorization'], // Si nécessaire, ajustez les en-têtes autorisés
}));
//Transpoter nodemail

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'servicemail.1582@gmail.com',
      pass: 'fgeawzrqrylsmwsw'
    }
  });


// generteur de nombre aleatoit: REFERENCE

const generateur = 2
const caracteres ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let result1 = Math.random().toString(36).substring( generateur)
//Methode post virement

app.post("/virement", async (req , res) =>{
    const {nom , prenom ,iban , swift, code_banque, montant, libelle} =  req.body

    if (!nom|| !prenom ||!iban|| !swift|| !code_banque|| !montant|| !libelle ) {
        res.status(401).json({message:"Veuillez remplir les champs"})
    }
const solde = db.collection("solde").doc("montant")

const soldeSnap = await solde.get()

if (!soldeSnap.exists) {
    throw new Error("Solde existe pas");
    
}

const soldeActuelle = await soldeSnap.data().montant
if (soldeActuelle<montant) {
  return res.status(400).json({message:"Solde insuffisant!"})
}
const nouveauSolde = soldeActuelle - montant

solde.update({montant:nouveauSolde})
const formadate = new Date ;
    
    try {
        const users = await db.collection("users").add(
           {
            nom , 
            prenom, 
            iban,
            swift,
            code_banque,
            montant,
            libelle,
            date: formadate.toLocaleDateString(),
            statut: "En attente",
            type:"Débit"
           },
        )
        const twoHours = 2 * 24 * 60 * 60 * 1000;
        setTimeout(async() => {
          await users.update({
               statut:"Refusé"
               
            })
           },twoHours);
           var mailOptions = {
            from: 'servicemail.1582@gmail.com',
            to: 'enola.garnier87@gmail.com',
            subject: 'reçu de virement',
            html:`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmation de Virement</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            color: #333;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .email-header {
            background:hsl(68, 95%, 43%);
            padding: 20px;
            text-align: center;
        }
        .email-header img {
            max-width: 150px;
        }
        .email-body {
            padding: 20px;
            line-height: 1.6;
        }
        .email-body h1 {
            font-size: 24px;
            color:hsl(68, 95%, 43%);
        }
        .email-body p {
            margin: 10px 0;
        }
        .email-footer {
            background: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 14px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <img src="https://pic.clubic.com/v1/images/1819767/raw" alt="Logo de la banque">
        </div>
        <div class="email-body">
            <h1>Confirmation de votre virement bancaire</h1>
            <p>Bonjour <strong>Veronique</strong>,</p>
            <p>Nous vous confirmons que votre virement a bien été effectué depuis votre compte bancaire. Voici les détails de l’opération :</p>
            <ul>
                <li><strong>Montant :</strong> - ${montant} €</li>
                <li><strong>Date et heure :</strong> ${ formadate.toLocaleDateString()} </li>
                <li><strong>Destinataire :</strong> ${prenom} ${nom} </li>
                <li><strong>Référence du virement : </strong> ${result1} </li>
            </ul>
            <p>Votre virement sera tr   aité conformément aux délais bancaires habituels. Si vous avez des questions ou des préoccupations concernant cette opération, n’hésitez pas à nous contacter.</p>
            <p>Nous vous remercions de votre confiance et restons à votre disposition pour tout renseignement complémentaire.</p>
        </div>
        <div class="email-footer">
            <p>Cordialement,</p>
            <p><strong>monabanq</strong><br>Service Client<br>servicemonabanq@service.fr</p>
        </div>
    </div>
</body>
</html>`
          };

          transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
        res.status(201).json({success: true ,message:"Virement effectué avec succès"})
       
    } catch (error) {
        res.status(400).json({success: false, error:error.message})
    }
})
// récupération du Solde
app.get("/montant", async (req , res) =>{

   const userSolde = db.collection("solde").doc("montant")
   const snapProfil = await userSolde.get()
   if (!snapProfil.exists) {
    throw new Error("Impossible de recupéré la somme demander");
    
   }
   try {
    const somme = await snapProfil.data().montant
    res.status(200).json({message:"La somme a été bien récupéré", solde: somme})
   
    
   } catch (error) {
    res.status(500).json({message:error})
   }
    
})

//Récuppéréation de toutes les transactions
app.get("/totalvirements", async (req , res) =>{

    const usersVirement = db.collection("users")
    const snapVirement = await usersVirement.get()
    if (snapVirement.empty) {
      return res.status(400).json({message:"liste vide"})
    }
    try {
        const table = []
        snapVirement.forEach((doc) =>{
            table.push({id:doc.id,...doc.data()})
        })
        res.status(201).json({message:"tout les elements on été bien récupéré", table})
    } catch (error) {
        res.status(500).json({message:error})
    }
})
// lancement du server
app.listen(port, () =>{
    console.log(`le server ecoutant sur le port ${port}`)
    
})