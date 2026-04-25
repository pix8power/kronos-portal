const mongoose = require('mongoose');

const webAuthnCredentialSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    credentialID: { type: String, required: true, unique: true },
    credentialPublicKey: { type: String, required: true }, // base64url encoded Buffer
    counter: { type: Number, required: true, default: 0 },
    deviceType: { type: String }, // 'singleDevice' | 'multiDevice'
    backedUp: { type: Boolean, default: false },
    transports: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('WebAuthnCredential', webAuthnCredentialSchema);
