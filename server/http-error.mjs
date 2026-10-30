// Erreur prévue par l'API : le serveur renvoie son statut HTTP et son message au client.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Vérifie un entier borné, qu'il vienne d'un paramètre d'URL ou d'un corps JSON.
export function integerInRange(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new HttpError(400, `${label} doit être un entier compris entre ${min} et ${max}.`);
  return value;
}
