import mongoose, { Schema } from "mongoose";

const RequestItemSchema = new Schema({
    equipmentID:    { type: String, required: true },
    qty:            { type: Number, required: true },
    notes:          { type: String },       
}, { _id: false });

const RequestBackupSchema = new Schema({
  docId:              { type: String, required: true, unique: true },
  requestID:          { type: String },
  userID:             { type: String, required: true },
  items:              { type: [RequestItemSchema], required: true },
  status:             { type: String, enum: ['pending', 'approved', 'rejected', 'ongoing', 'returned', 'completed'] },
  startDate:          { type: String },
  endDate:            { type: String },
  purpose:            { type: String },
  approvedBy:         { type: String },
  approvedAt:         { type: String },
  rejectedBy:         { type: String },
  rejectedAt:         { type: String },
  rejectionReason:    { type: String },
  overriddenBy:       { type: String },
  overriddenAt:       { type: String },
  overrideReason:     { type: String },
  overrideFromStatus: { type: String, enum: ['approved', 'rejected'] },
  returnedAt:         { type: String },
  createdAt:          { type: String },
  updatedAt:          { type: String },
}, { timestamps: true });

export const RequestBackup = mongoose.model('RequestBackup', RequestBackupSchema);