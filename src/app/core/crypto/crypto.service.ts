import { Injectable } from '@angular/core';
import * as forge from 'node-forge';

/**
 * RSA password encryption — mirrors the existing POS client behaviour
 * the server already decrypts. The plaintext password (or PIN) is
 * encrypted with the server's public key and then base64-encoded.
 *
 * Algorithm: RSA-PKCS1 (matches node-forge's default `rsa.encrypt`,
 * which is what the legacy client uses with the same public key).
 *
 * The public key is the production server's — same key the existing
 * desktop client uses. Don't change it without rotating the server-side
 * private key too.
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  /**
   * 2048-bit RSA public key from the POS API. The corresponding
   * private key lives on the server side. The legacy desktop client
   * uses this exact key; we mirror the behaviour so login bodies
   * are wire-compatible.
   */
  private readonly publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAskgPKBcNpz71mi4NSYa5
mazJrO0WZim7T2yy7qPxk2NqQE7OmWWakLJcaeUYnI0kO3yC57vck66RPCjKxWuW
SGZ7dHXe0bWb5IXjcT4mNdnUIalR+lV8czsoH/wDUvkQdG1SJ+IxzW64WvoaCRZ+
/4wBF2cSUh9oLwGEXiodUJ9oJXFZVPKGCEjPcBI0vC2ADBRmVQ1sKsZg8zbHN+gu
U9rPLFzN4YNrCnEsSezVw/W1FKVS8J/Xx4HSSg7AyVwniz8eHi0e3a8VzFg+H09I
5wK+w39sjDYfAdnJUkr6PjtSbN4/Sg/NMkKB2Ngn8oj7LCfe/7RNqIdiS+dQuSFg
eQIDAQAB
-----END PUBLIC KEY-----`;

  private rsa: forge.pki.rsa.PublicKey | null = null;

  /**
   * Encrypt a plaintext password using the server's RSA public key
   * and return the base64-encoded ciphertext that the server expects.
   *
   * Works for BOTH a real password and a numeric PIN — the API field
   * is the same (`TokenRequestModel.Password`) in either mode.
   *
   * Returns the empty string for an empty input — caller is responsible
   * for validating non-empty before submitting.
   */
  encryptPassword(plaintext: string): string {
    if (!plaintext) return '';
    if (!this.rsa) {
      this.rsa = forge.pki.publicKeyFromPem(this.publicKey);
    }
    const ciphertext = this.rsa.encrypt(plaintext);
    // forge returns a binary string; window.btoa converts to base64
    // exactly as the legacy desktop client does.
    return window.btoa(ciphertext);
  }
}
