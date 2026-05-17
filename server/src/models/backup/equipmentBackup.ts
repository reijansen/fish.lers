import mongoose, { Schema } from 'mongoose';

const EquipmentBackupSchema = new Schema({
  docId:          { type: String, required: true, unique: true },
  equipmentID:    { type: String },
  imageLink:      { type: String },
  name:           { type: String, required: true },
  totalInventory: { type: Number },
  categoryID:       { type: String },
  isDisposable:   { type: Boolean },
  isDeleted:      { type: Boolean },
  deletedAt:      { type: String },
  serialNumbers:  { type: [String] },
  createdAt:      { type: String },
  updatedAt:      { type: String },
}, { timestamps: true });

export const EquipmentBackup = mongoose.model('EquipmentBackup', EquipmentBackupSchema);