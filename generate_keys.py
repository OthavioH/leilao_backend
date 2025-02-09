import os
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import json

keys_file_name = ".keys/valid_public_keys.json"

# Gera um par de chaves RSA (2048 bits para segurança)
key_pair = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)

# Exporta a chave privada como PEM (formato seguro para armazenar)
private_key_pem = key_pair.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption()
).decode()

# Exporta a chave pública como PEM
public_key_pem = key_pair.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
).decode()

# Exibe as chaves no terminal
print("\n🔑 Chave Privada:")
print(private_key_pem)

print("\n🔓 Chave Pública:")
print(public_key_pem)

# Salvar as chaves em um arquivo JSON para uso no servidor
keys_json = {
    "private_key": private_key_pem,
    "public_key": public_key_pem
}

# Verifica se o arquivo já existe
if os.path.exists(keys_file_name):
    with open(keys_file_name, "r") as json_file:
        existing_keys = json.load(json_file)
else:
    existing_keys = []

# Adiciona as novas chaves à lista existente
existing_keys.append(keys_json)

# Salva a lista atualizada no arquivo JSON
with open(keys_file_name, "w") as json_file:
    json.dump(existing_keys, json_file, indent=4)

print("\n📁 As chaves foram salvas no arquivo 'chaves.json'!")
