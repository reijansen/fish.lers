import mongoose, { Schema } from 'mongoose';

const UserBackupSchema = new Schema({
  docId:        { type: String, required: true, unique: true },
  uid:          { type: String },
  email:        { type: String },
  displayName:  { type: String },
  role:         { type: String, enum: ['student', 'admin'] },
  isSuperAdmin: { type: Boolean },
  isActive:     { type: Boolean },
  createdAt:    { type: String },
  updatedAt:    { type: String },
}, { timestamps: true });

export const UserBackup = mongoose.model('UserBackup', UserBackupSchema);