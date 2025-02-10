import { constants, createCipheriv, createDecipheriv, createSign, createVerify, privateDecrypt, publicDecrypt, publicEncrypt, randomBytes, sign } from "crypto";
import * as fs from "fs";

export default class EncryptionService {
    async encryptMessageWithPublicKey(simmetricKey: Buffer<ArrayBufferLike>, user_id: string): Promise<string | null> {
        const userKey = await this.getUserPublicKey(user_id);
        if (!userKey) {
            return null;
        }

        const encryptedMessage = publicEncrypt({
            key: userKey,
            padding: constants.RSA_PKCS1_PADDING,
        }, simmetricKey).toString("base64");

        return encryptedMessage;
    }

    async isMessageValid(plain_text: string, signature: string, userId: string): Promise<boolean> {
        const userKey = await this.getUserPublicKey(userId);

        if (!userKey) {
            return false;
        }

        console.log("User Key:", userKey);
        console.log("Signature:", signature);

        const verifier = createVerify("SHA256");
        verifier.update(plain_text);

        return verifier.verify(userKey, Buffer.from(signature, "base64"));
    }

    async getUserPublicKey(userId: string): Promise<string | null> {
        const keys = JSON.parse(fs.readFileSync("./src/keys/valid_public_keys.json", "utf8"));
        const userKey = keys.find((key: any) => key.user_id === userId);
        return userKey.public_key ?? null;
    }


    async encryptMessageWithSymmetricKey(message: string, symmetricKey: Buffer<ArrayBufferLike>): Promise<string> {
        const iv = randomBytes(16);
        const cipher = createCipheriv("aes-256-cbc", symmetricKey, iv);
        let encryptedMessage = cipher.update(message, "utf-8", "base64");
        encryptedMessage += cipher.final("base64");
        console.log("Encrypted message:", encryptedMessage);

        var encrypted = iv.toString("base64") + ":" + encryptedMessage;

        // var decrypted = await this.decryptMessageWithSymmetricKey(encrypted, symmetricKey);

        return encrypted;
    }

    async decryptMessageWithSymmetricKey(encryptedMessage: string, symmetricKey: Buffer<ArrayBufferLike>): Promise<string> {
        const [ivBase64, encryptedBase64] = encryptedMessage.split(":");

        if (!ivBase64 || !encryptedBase64) {
            throw new Error("Formato de mensagem inválido");
        }

        const iv = Buffer.from(ivBase64, "base64");
        const encrypted = Buffer.from(encryptedBase64, "base64");

        const decipher = createDecipheriv("aes-256-cbc", symmetricKey, iv);
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString("utf-8");
    }
}