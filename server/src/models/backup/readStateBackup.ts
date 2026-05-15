import mongoose, { Schema } from 'mongoose';

const ReadStateBackupSchema = new Schema({
  docId:              { type: String, required: true, unique: true }, // conversationID:userUID
  conversationID:     { type: String },
  userUID:            { type: String },
  readUpToMessageID:  { type: String },
  readUpToTimestamp:  { type: String },
  unreadCount:        { type: Number },
  lastUpdatedAt:      { type: String },
}, { timestamps: true });

export const ReadStateBackup = mongoose.model('ReadStateBackup', ReadStateBackupSchema);