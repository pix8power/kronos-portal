const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['admin', 'manager', 'charge_nurse', 'employee'], default: 'employee' },
    position: { type: String, default: '' },
    department: { type: String, default: '' },        // primary / active department
    departments: { type: [String], default: [] },     // all departments managed (managers)
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    color: { type: String, default: '#3B82F6' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    mustChangePassword: { type: Boolean, default: false },
    lastLogin:     { type: Date },
    // Profile extras
    hireDate:      { type: String, default: '' },
    seniorityDate: { type: String, default: '' },
    bio:           { type: String, default: '' },
    licenseNumber: { type: String, default: '' },
    licenseExpiry:  { type: String, default: '' },
    blsCprExpiry:   { type: String, default: '' },
    certifications: [{
      name:   { type: String },
      number: { type: String, default: '' },
      expiry: { type: String },
    }],
    documents: [{
      name:       { type: String },
      filename:   { type: String },
      uploadedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
