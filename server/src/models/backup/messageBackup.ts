import mongoose, { Schema } from 'mongoose';

const MessageBackupSchema = new Schema({
  docId:          { type: String, required: true, unique: true }, // messageID
  conversationID: { type: String, required: true },
  messageID:      { type: String },
  senderUID:      { type: String },
  senderRole:     { type: String, enum: ['student', 'admin', 'superAdmin'] },
  content:        { type: String },
  idempotencyKey: { type: String },
  createdAt:      { type: String },
  updatedAt:      { type: String },
  deletedAt:      { type: String },
}, { timestamps: true });

// Index for fast lookup by conversation
MessageBackupSchema.index({ conversationID: 1, createdAt: 1 });

export const MessageBackup = mongoose.model('MessageBackup', MessageBackupSchema);