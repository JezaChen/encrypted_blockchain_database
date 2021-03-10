"use strict";

const crypto = require('crypto');

class AES256 {
    static generate_key() {
        return crypto.randomBytes(32);
    }

    static generate_iv() {
        return crypto.randomBytes(16);
    }

    static encrypt(key, message, iv, message_type = "utf-8") {
        let cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(message, message_type, 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }

    static decrypt(key, cipher, iv, message_type = "utf-8") {
        let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(cipher, 'base64', message_type);
        return (decrypted + decipher.final(message_type));
    }
}

class HMAC_SHA256 {
    /***
     * @returns Buffer The buffer of the digest of message
     * */
    static digest(key, message) {
        let hmac = crypto.createHmac("sha256", key);
        hmac.update(message);
        return hmac.digest();
    }
}

module.exports = {AES256: AES256, HMAC_SHA256: HMAC_SHA256};