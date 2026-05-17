import mongoose, { Schema } from 'mongoose';

const ConversationBackupSchema = new Schema({
  docId:                  { type: String, required: true, unique: true },
  conversationID:         { type: String },
  type:                   { type: String, enum: ['support', 'escalation', 'staff'] },
  status:                 { type: String, enum: ['active', 'closed'] },
  studentUID:             { type: String },
  adminUID:               { type: String },
  escalationID:           { type: String },
  escalationReason:       { type: String },
  staffKey:               { type: String },
  participants:           { type: [String] },
  messageCount:           { type: Number },
  lastMessageAt:          { type: String },
  lastMessagePreview:     { type: String },
  lastMessageSenderUID:   { type: String },
  lastMessageSenderRole:  { type: String, enum: ['student', 'admin', 'superAdmin'] },
  closedAt:               { type: String },
  createdAt:              { type: String },
  updatedAt:              { type: String },
}, { timestamps: true });

export const ConversationBackup = mongoose.model('ConversationBackup', ConversationBackupSchema);