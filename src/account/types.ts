enum CryptoType {
  SR25519 = "sr25519",
  ED25519 = "ed25519",
  ECDSA = "ecdsa",
}

enum AccountSourceType {
  PRIVATE_KEY = "privateKey",
  SEED = "seed",
  MNEMONIC = "mnemonic",
  DERIVED = "derived",
  ADDRESS = "address",
}

export { CryptoType, AccountSourceType };
