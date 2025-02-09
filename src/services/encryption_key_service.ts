import { createCipheriv, createDecipheriv, createSign, createVerify, publicDecrypt, randomBytes, sign } from "crypto";
import * as fs from "fs";

export default class EncryptionService {
    async encryptMessageWithPublicKey(simmetricKey: String, user_id: string): Promise<string | null> {
        const userKey = await this.getUserPublicKey(user_id);
        if (!userKey) {
            return null;
        }

        const encryptedMessage = publicDecrypt(userKey, Buffer.from(simmetricKey, "base64")).toString("base64");

        return encryptedMessage;
    }

    async verifyPrivateKey(privateKey: string) {
        // Assina uma mensagem com a chave privada
        const message = "Teste de assinatura de chave";
        const signer = createSign("SHA256");
        signer.update(message);
        signer.end();
        const assinatura = signer.sign(privateKey, "base64");

        // Verifica a assinatura com a chave pública
        const verifier = createVerify("SHA256");
        verifier.update(message);
        verifier.end();

        if (verifier.verify(privateKey, assinatura, "base64")) {
            return true;
        } else {
            return false;
        }
    }

    async isMessageValid(signature: string, userId: string): Promise<boolean> {
        const userKey = await this.getUserPublicKey(userId);

        if (!userKey) {
            return false;
        }

        console.log("User Key:", userKey);
        console.log("Signature:", signature);
        
        const verifier = createVerify("SHA256");
        verifier.update(signature);
        verifier.end();

        return verifier.verify(userKey, signature, "base64");
    }

    async getUserPublicKey(userId: string): Promise<string | null> {
        const keys = JSON.parse(fs.readFileSync("./src/keys/valid_public_keys.json", "utf8"));
        const userKey = keys.find((key: any) => key.user_id === userId);
        return userKey.public_key ?? null;
    }


    async encryptMessageWithSymmetricKey(message: string, symmetricKey: string): Promise<string> {
        const iv = randomBytes(16);
        const cipher = createCipheriv("aes-256-cbc", symmetricKey, iv);
        let encryptedMessage = cipher.update(message, "utf8", "base64");
        encryptedMessage += cipher.final("base64");

        return iv.toString("base64") + ":" + encryptedMessage;
    }

    async decryptMessageWithSymmetricKey(encryptedMessage: string, symmetricKey: string): Promise<string> {
        const [ivBase64, encryptedBase64] = encryptedMessage.split(":");

        if (!ivBase64 || !encryptedBase64) {
            throw new Error("Formato de mensagem inválido");
        }

        const iv = Buffer.from(ivBase64, "base64");
        const encrypted = Buffer.from(encryptedBase64, "base64");

        const decipher = createDecipheriv("aes-256-cbc", symmetricKey, iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString("utf-8");
    }
}