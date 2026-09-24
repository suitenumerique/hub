// Local translations for the encryption UI, pending the next Crowdin delivery.
// English t() keys remain extractable; delivered translations take precedence.
// Keep hand-authored additions here instead of editing generated JSON files.
export const localUiTranslations: Record<string, Record<string, string>> = {
  fr: {
    "Another Hub tab is using this session. Close that tab, then try again here. You can keep Element open.":
      "Un autre onglet Hub utilise cette session. Fermez cet onglet, puis réessayez ici. Vous pouvez garder Element ouvert.",
    "This browser cannot protect encryption storage. Use a browser that supports Web Locks.":
      "Ce navigateur ne permet pas de protéger le stockage du chiffrement. Utilisez un navigateur compatible avec Web Locks.",
    "This device’s local keys are missing or no longer match its session. Stored data has not been deleted. A new device session is required.":
      "Les clés locales de cet appareil sont absentes ou ne correspondent plus à sa session. Les données conservées n’ont pas été effacées. Une nouvelle session d’appareil est nécessaire.",
    "The server or storage is unavailable. Your keys are preserved. Try again when the connection is restored.":
      "Le serveur ou le stockage est indisponible. Vos clés sont conservées. Réessayez lorsque la connexion est rétablie.",
    "Chat connection interrupted": "Connexion à la messagerie interrompue",
    "Try again": "Réessayer",
    "Reconnect Hub with a new device":
      "Reconnecter le Hub avec un nouvel appareil",
    "Reconnection failed. Check your connection and try again.":
      "La reconnexion n’a pas abouti. Vérifiez la connexion et réessayez.",
    "Log out": "Se déconnecter",
    "Encrypted message awaiting decryption…":
      "Message chiffré en attente de déchiffrement…",
    "Unsupported attachment: {{name}}":
      "Pièce jointe non prise en charge : {{name}}",
    "Encrypted message unavailable: the sender is waiting for this device to be verified.":
      "Message chiffré indisponible : l’expéditeur attend la vérification de cet appareil.",
    "Encrypted message unavailable: the sender has not shared its key.":
      "Message chiffré indisponible : l’expéditeur n’a pas partagé sa clé.",
    "Message not decrypted: the sender’s encryption identity has changed.":
      "Message non déchiffré : l’identité de chiffrement de l’expéditeur a changé.",
    "Message not decrypted: the sender’s device is not recognized.":
      "Message non déchiffré : l’appareil de l’expéditeur n’est pas reconnu.",
    "This message could not be decrypted. Stored keys have not been deleted.":
      "Impossible de déchiffrer ce message. Les clés conservées n’ont pas été effacées.",
    "Encrypted message unavailable. Its key has not been recovered yet.":
      "Message chiffré indisponible. Sa clé n’a pas encore été récupérée.",
    "Verify this device and wait for its keys before sending messages.":
      "Vérifiez cet appareil et attendez la réception de ses clés avant d’envoyer.",
    "The encrypted message was rejected or interrupted. Check your connection and device security, then try again. Your draft is saved.":
      "L’envoi chiffré a été refusé ou interrompu. Vérifiez la connexion et la sécurité des appareils, puis réessayez. Votre brouillon est conservé.",
    "Attachments are not supported yet.":
      "Les pièces jointes ne sont pas encore prises en charge.",
    "Verify encryption before sending a message.":
      "Vérifiez le chiffrement pour envoyer un message.",
    "The server could not be reached. Check your connection and try again.":
      "Le serveur est injoignable. Vérifiez votre connexion et réessayez.",
    "The server denied this action. Check your access to this conversation or account.":
      "Le serveur a refusé cette action. Vérifiez vos droits d’accès à cette conversation ou à ce compte.",
    "Your session is no longer valid. Reconnect your account and try again.":
      "Votre session n’est plus valide. Reconnectez votre compte et réessayez.",
    "The server is receiving too many requests. Wait a moment and try again.":
      "Le serveur reçoit trop de requêtes. Patientez un instant puis réessayez.",
    "The devices’ encryption could not be verified. Check encryption settings before retrying.":
      "Le chiffrement des appareils n’a pas pu être vérifié. Vérifiez les paramètres de chiffrement avant de réessayer.",
    "Encryption storage is unavailable in this browser. Check available storage and try again.":
      "Le stockage du chiffrement est indisponible dans ce navigateur. Vérifiez l’espace disponible et réessayez.",
    "This action could not be completed. Please try again.":
      "Cette action n’a pas abouti. Veuillez réessayer.",
    "Recover message history": "Récupérer l’historique des messages",
    "your reference app": "votre application de référence",
    "Device verification": "Vérification de l’appareil",
    "Use the same account on both devices: {{userId}}":
      "Utilisez le même compte sur les deux appareils : {{userId}}",
    "Cancel verification": "Annuler la vérification",
    Close: "Fermer",
    "Checking the security of this browser…":
      "Vérification de la sécurité de ce navigateur…",
    "Set up encryption in {{client}}, then return here to verify this device.":
      "Configurez le chiffrement dans {{client}}, puis revenez ici pour vérifier cet appareil.",
    "Your encryption identity has changed. Verify this device again before sending encrypted messages.":
      "Votre identité de chiffrement a changé. Vérifiez à nouveau cet appareil pour envoyer des messages chiffrés.",
    "First sign in to {{client}} with the same account and set up encryption there.":
      "Connectez-vous d’abord à {{client}} avec le même compte et configurez-y le chiffrement.",
    "Confirm that this browser belongs to you by comparing emojis with another device signed in to the same account.":
      "Confirmez que ce navigateur vous appartient en comparant des emojis avec un autre appareil connecté au même compte.",
    "This device is verified. Encryption will be available once the keys from your other device have arrived.":
      "Cet appareil est vérifié. Le chiffrement sera disponible une fois les clés de votre autre appareil reçues.",
    "You can send encrypted messages from this browser.":
      "Vous pouvez envoyer des messages chiffrés depuis ce navigateur.",
    "Checking your backup…": "Vérification de votre sauvegarde…",
    "Verify this device first to access your backup and recover your message history.":
      "Vérifiez d’abord cet appareil pour accéder à votre sauvegarde et retrouver votre historique de messages.",
    "No key backup is configured. Set one up in {{client}} to recover your messages on a new device.":
      "Aucune sauvegarde de clés n’est configurée. Activez-la dans {{client}} pour retrouver vos messages sur un nouvel appareil.",
    "This backup cannot be trusted yet. Recover your account in {{client}} before using it.":
      "Cette sauvegarde n’a pas pu être vérifiée. Récupérez votre compte dans {{client}} pour pouvoir l’utiliser.",
    "Keep {{client}} open and unlocked while the backup key is shared with this browser.":
      "Gardez {{client}} ouvert et déverrouillé pendant le transfert de la clé de sauvegarde vers ce navigateur.",
    "The backup is temporarily unavailable. Keys already on this device are kept; try again when the connection is restored.":
      "La sauvegarde est temporairement indisponible. Les clés déjà présentes sur cet appareil sont conservées. Réessayez une fois la connexion rétablie.",
    "Your encryption keys are backed up securely so you can recover messages on another device.":
      "Vos clés de chiffrement sont sauvegardées de façon sécurisée pour retrouver vos messages sur un autre appareil.",
    "Manage this device’s security and access to your encrypted messages.":
      "Gérez la sécurité de cet appareil et l’accès à vos messages chiffrés.",
    "This action could not be completed. Check your connection and try again.":
      "Cette action n’a pas abouti. Vérifiez votre connexion et réessayez.",
    "This device": "Cet appareil",
    Verified: "Vérifié",
    "Checking…": "Vérification…",
    "Set up required": "À configurer",
    "Verification required": "À vérifier",
    "The keys are taking longer than expected. Keep {{client}} open and unlocked, then retry recovery.":
      "Les clés tardent à arriver. Gardez {{client}} ouvert et déverrouillé, puis réessayez la récupération.",
    "Verify this device": "Vérifier cet appareil",
    "Open {{client}}": "Ouvrir {{client}}",
    "Backup and history": "Sauvegarde et historique",
    Active: "Active",
    "Pending verification": "Après vérification",
    "Waiting for keys": "En attente des clés",
    "Needs attention": "Action nécessaire",
    "Only messages whose keys are in the backup can be recovered. Keep the recovery key provided by {{client}} in a safe place.":
      "Seuls les messages dont les clés ont été sauvegardées pourront être retrouvés. Conservez en lieu sûr la clé de récupération fournie par {{client}}.",
    "Recovering your message history…":
      "Récupération de votre historique en cours…",
    "Some message history could not be recovered. Messages already recovered remain available.":
      "Une partie de l’historique n’a pas pu être récupérée. Les messages déjà retrouvés restent disponibles.",
    "Backing up new keys…": "Sauvegarde des nouvelles clés en cours…",
    "Retry recovery": "Réessayer la récupération",
    "Technical details": "Détails techniques",
    "These identifiers and counters can help diagnose a problem.":
      "Ces identifiants et compteurs peuvent aider à diagnostiquer un problème.",
    "Matrix account": "Compte Matrix",
    "Device ID": "Identifiant de l’appareil",
    "Reference device": "Appareil de référence",
    "Backup version": "Version de la sauvegarde",
    "Keys awaiting backup": "Clés restant à sauvegarder",
    "Keys recovered from backup": "Clés récupérées depuis la sauvegarde",
    "Sending the request…": "Envoi de la demande…",
    "Another device on your account is requesting verification of this Hub device.":
      "Un autre appareil de votre compte demande à vérifier cet appareil Hub.",
    "Open {{client}} with the same account and accept the verification. If no device is available, cancel and recover your account in that app.":
      "Ouvrez {{client}} avec le même compte, puis acceptez la vérification. Si aucun appareil n’est disponible, annulez et récupérez votre compte dans ce client.",
    "Compare the symbols on both devices, in the same order.":
      "Comparez les symboles dans les deux appareils, dans le même ordre.",
    "Confirmation sent. Confirm on your other device too.":
      "Confirmation envoyée. Confirmez également dans votre autre appareil.",
    "Verification complete. Keys and backup are checked separately.":
      "Vérification terminée. Les clés et la sauvegarde sont vérifiées séparément.",
    "The request has expired. You can try again.":
      "La demande a expiré. Vous pouvez recommencer.",
    "The symbols do not match. Verification has been cancelled.":
      "Les symboles sont différents. La vérification a été annulée.",
    "Verification has been cancelled.": "La vérification a été annulée.",
    "Verification failed. Check the connection on both devices and try again.":
      "La vérification n’a pas abouti. Vérifiez la connexion des deux appareils puis recommencez.",
    "The seven verification symbols": "Les sept symboles de vérification",
    "This app uses three numbers instead of emojis. Compare all three in the same order.":
      "Ce client utilise trois nombres au lieu des emojis. Comparez les trois nombres dans le même ordre.",
    "No compatible comparison code. Cancel and try again.":
      "Aucun code de comparaison compatible. Annulez et recommencez.",
    Accept: "Accepter",
    "They match": "Ils correspondent",
    "They do not match": "Ils sont différents",
    "Account menu": "Menu du compte",
    "Terms of service": "CGU",
    Encryption: "Chiffrement",
    "Encryption enabled": "Chiffrement activé",
    "Messages in this conversation are end-to-end encrypted.":
      "Les messages de cette conversation sont chiffrés de bout en bout.",
    "This conversation is not encrypted.":
      "Cette conversation n’est pas chiffrée.",
    "Set up encryption to send messages.":
      "Configurez le chiffrement pour envoyer des messages.",
    "Open encryption settings": "Configurer le chiffrement",
  },
  de: {
    "Account menu": "Kontomenü",
    "Terms of service": "Nutzungsbedingungen",
    Encryption: "Verschlüsselung",
    "Encryption enabled": "Verschlüsselung aktiviert",
    "Messages in this conversation are end-to-end encrypted.":
      "Nachrichten in dieser Unterhaltung sind Ende-zu-Ende-verschlüsselt.",
    "This conversation is not encrypted.":
      "Diese Unterhaltung ist nicht verschlüsselt.",
    "Set up encryption to send messages.":
      "Richten Sie die Verschlüsselung ein, um Nachrichten zu senden.",
    "Open encryption settings": "Verschlüsselung einrichten",
  },
};
